// worker/index.js
var WEEK = 60 * 60 * 24 * 7;
var ADMIN_SELLER_ID = "9b19dda2-cdda-435b-bb14-b731eb79352c";
var utf8 = new TextEncoder();
var json = (body2, status = 200, headers = {}) => new Response(JSON.stringify(body2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
var normalizedEmail = (value) => String(value || "").trim().toLowerCase();
var makeStoreSlug = (name, id) => `${String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44) || "loja"}-${id.slice(0, 6)}`;
var digest = async (value) => new Uint8Array(await crypto.subtle.digest("SHA-256", typeof value === "string" ? utf8.encode(value) : value));
var hex = (bytes) => [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
var randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", utf8.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(salt.match(/.{2}/g), (b) => parseInt(b, 16)), iterations: 1e5 }, key, 256));
}
var cookie = (value, maxAge) => `vertice_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
var BODY_TYPES = ["", "sport", "hatch", "sedan", "suv", "pickup", "classic"];
function safeListing(row) {
  return { id: row.id, sellerId: row.sellerId, make: row.make, model: row.model, year: row.year, mileage: row.mileage, price: row.price, location: row.location, bodyType: row.bodyType || "", image: row.image, description: row.description, whatsapp: row.whatsapp, createdAt: row.createdAt };
}
async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
function validOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
async function currentSeller(request, db) {
  const match = request.headers.get("cookie")?.match(/(?:^|;\s*)vertice_session=([\w-]{30,100})/);
  if (!match) return null;
  return db.prepare("SELECT sellers.id, sellers.email, sellers.display_name AS displayName, sellers.store_slug AS storeSlug, sellers.plan FROM sessions JOIN sellers ON sellers.id = sessions.seller_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?").bind(await digest(match[1]).then(hex), Date.now()).first();
}
var RESET_LIFETIME = 30 * 60 * 1e3;
var RESET_COOLDOWN = 60 * 1e3;
function listingInput(data) {
  if (!data || typeof data !== "object") return null;
  const make = String(data.make || "").trim(), model = String(data.model || "").trim(), location = String(data.location || "").trim(), bodyType = String(data.bodyType || "").trim(), description = String(data.description || "").trim(), year = Number(data.year), mileage = Number(data.mileage), price = Number(data.price), whatsapp = String(data.whatsapp || "").replace(/\D/g, ""), image = String(data.image || "").trim();
  if (make.length < 2 || make.length > 40 || model.length < 1 || model.length > 80 || location.length < 3 || location.length > 80 || !BODY_TYPES.includes(bodyType) || !Number.isInteger(year) || year < 1950 || year > (/* @__PURE__ */ new Date()).getFullYear() + 1 || !Number.isInteger(mileage) || mileage < 0 || mileage > 2e6 || !Number.isSafeInteger(price) || price < 100 || price > 9999999999 || !/^[1-9][0-9]{11,12}$/.test(whatsapp) || description.length > 800 || image && !/^cars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(image)) return null;
  return { make, model, location, bodyType, description, year, mileage, price, whatsapp, image: image || null };
}
var index_default = { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/media/")) {
    const key = decodeURIComponent(url.pathname.slice(7));
    if (!/^cars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(key) || !env.BUCKET) return new Response("Imagem n\xE3o encontrada.", { status: 404 });
    const image = await env.BUCKET.get(key);
    if (!image) return new Response("Imagem n\xE3o encontrada.", { status: 404 });
    const headers = new Headers();
    image.writeHttpMetadata(headers);
    headers.set("cache-control", "public, max-age=3600");
    headers.set("x-content-type-options", "nosniff");
    headers.set("content-security-policy", "default-src 'none'; sandbox");
    return new Response(image.body, { headers });
  }
  if (url.pathname.startsWith("/api/")) {
    if (!env.DB) return json({ error: "O estoque estar\xE1 dispon\xEDvel em instantes." }, 503);
    const db = env.DB;
    if (!validOrigin(request) && request.method !== "GET") return json({ error: "Origem inv\xE1lida." }, 403);
    try {
      if (url.pathname === "/api/session" && request.method === "GET") {
        let seller = await currentSeller(request, db);
        if (seller && !seller.storeSlug) {
          seller.storeSlug = makeStoreSlug(seller.displayName, seller.id);
          await db.prepare("UPDATE sellers SET store_slug=? WHERE id=? AND store_slug=''").bind(seller.storeSlug, seller.id).run();
        }
        return json({ seller: seller ? { ...seller, isAdmin: seller.id === ADMIN_SELLER_ID } : null });
      }
      if (url.pathname === "/api/store" && request.method === "GET") {
        let seller = await currentSeller(request, db);
        if (!seller) return json({ error: "Entre na sua conta." }, 401);
        if (!seller.storeSlug) {
          seller.storeSlug = makeStoreSlug(seller.displayName, seller.id);
          await db.prepare("UPDATE sellers SET store_slug=? WHERE id=? AND store_slug=''").bind(seller.storeSlug, seller.id).run();
        }
        return json({ storeSlug: seller.storeSlug, displayName: seller.displayName, plan: seller.plan || "free" });
      }
      const storeMatch = url.pathname.match(/^\/api\/stores\/([a-z0-9-]{3,60})$/);
      if (storeMatch && request.method === "GET") {
        const store = await db.prepare("SELECT id,display_name AS displayName,store_slug AS storeSlug FROM sellers WHERE store_slug=?").bind(storeMatch[1]).first();
        if (!store) return json({ error: "Esta loja n\xE3o foi encontrada." }, 404);
        const rows = await db.prepare("SELECT listings.id,listings.seller_id AS sellerId,listings.make,listings.model,listings.year,listings.mileage,listings.price,listings.location,listings.body_type AS bodyType,listings.image,listings.description,listings.whatsapp,listings.created_at AS createdAt,sellers.display_name AS sellerName FROM listings JOIN sellers ON sellers.id=listings.seller_id WHERE sellers.id=? ORDER BY listings.created_at DESC LIMIT 100").bind(store.id).all();
        return json({ store, listings: rows.results });
      }
      if (url.pathname === "/api/metrics" && request.method === "POST") {
        const input = await body(request), listingId = String(input?.listingId || ""), event = input?.event;
        if (!/^[\w-]{36}$/.test(listingId) || !["view", "whatsapp"].includes(event)) return json({ error: "M\xE9trica inv\xE1lida." }, 400);
        const listing = await db.prepare("SELECT seller_id AS sellerId FROM listings WHERE id=?").bind(listingId).first();
        if (!listing) return json({ error: "An\xFAncio n\xE3o encontrado." }, 404);
        const viewer = await currentSeller(request, db);
        if (viewer?.id === listing.sellerId) return json({ ok: true, ignored: true });
        await db.prepare("INSERT INTO listing_metrics(listing_id,views,whatsapp_clicks,updated_at) VALUES(?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET views=views+excluded.views,whatsapp_clicks=whatsapp_clicks+excluded.whatsapp_clicks,updated_at=excluded.updated_at").bind(listingId, event === "view" ? 1 : 0, event === "whatsapp" ? 1 : 0, Date.now()).run();
        return json({ ok: true }, 202);
      }
      if (url.pathname === "/api/admin/dashboard" && request.method === "GET") {
        const seller = await currentSeller(request, db);
        if (!seller) return json({ error: "Entre para continuar." }, 401);
        if (seller.id !== ADMIN_SELLER_ID) return json({ error: "Acesso restrito \xE0 administra\xE7\xE3o." }, 403);
        const [sellerTotal, listingTotal, activeSessions, recentSellers, recentListings] = await Promise.all([db.prepare("SELECT COUNT(*) AS count FROM sellers").first(), db.prepare("SELECT COUNT(*) AS count FROM listings").first(), db.prepare("SELECT COUNT(DISTINCT seller_id) AS count FROM sessions WHERE expires_at>?").bind(Date.now()).first(), db.prepare("SELECT sellers.id,sellers.display_name AS displayName,sellers.email,sellers.created_at AS createdAt,COUNT(listings.id) AS listingCount FROM sellers LEFT JOIN listings ON listings.seller_id=sellers.id GROUP BY sellers.id ORDER BY sellers.created_at DESC LIMIT 50").all(), db.prepare("SELECT listings.id,listings.make,listings.model,listings.year,listings.price,listings.location,listings.created_at AS createdAt,sellers.display_name AS sellerName,sellers.email,sellers.id AS sellerId FROM listings JOIN sellers ON sellers.id=listings.seller_id ORDER BY listings.created_at DESC LIMIT 50").all()]);
        return json({ totals: { sellers: sellerTotal.count, listings: listingTotal.count, activeSessions: activeSessions.count }, sellers: recentSellers.results, listings: recentListings.results });
      }
      if (url.pathname === "/api/admin/password" && request.method === "POST") {
        const seller = await currentSeller(request, db);
        if (!seller) return json({ error: "Entre para continuar." }, 401);
        if (seller.id !== ADMIN_SELLER_ID) return json({ error: "Acesso restrito \xE0 administra\xE7\xE3o." }, 403);
        const input = await body(request), currentPassword = String(input?.currentPassword || ""), newPassword = String(input?.newPassword || "");
        if (currentPassword.length > 128 || newPassword.length < 12 || newPassword.length > 128) return json({ error: "A nova senha deve ter entre 12 e 128 caracteres." }, 400);
        const account = await db.prepare("SELECT password_hash AS passwordHash,password_salt AS passwordSalt FROM sellers WHERE id=?").bind(seller.id).first();
        if (await passwordHash(currentPassword, account.passwordSalt) !== account.passwordHash) return json({ error: "A senha atual est\xE1 incorreta." }, 401);
        const salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await passwordHash(newPassword, salt), token = randomToken(), tokenHash = await digest(token).then(hex), now = Date.now();
        await db.batch([db.prepare("UPDATE sellers SET password_hash=?,password_salt=? WHERE id=?").bind(hash, salt, seller.id), db.prepare("DELETE FROM sessions WHERE seller_id=?").bind(seller.id), db.prepare("INSERT INTO sessions(token_hash,seller_id,expires_at) VALUES(?,?,?)").bind(tokenHash, seller.id, now + WEEK * 1e3)]);
        return json({ ok: true }, 200, { "set-cookie": cookie(token, WEEK) });
      }
      if (url.pathname === "/api/register" && request.method === "POST") {
        const input = await body(request);
        const email = normalizedEmail(input?.email), password = String(input?.password || ""), name = String(input?.name || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128 || name.length < 2 || name.length > 60) return json({ error: "Informe seu nome, um e-mail v\xE1lido e uma senha com ao menos 12 caracteres." }, 400);
        const id = crypto.randomUUID(), storeSlug = makeStoreSlug(name, id), salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await passwordHash(password, salt), token = randomToken();
        try {
          await db.prepare("INSERT INTO sellers (id,email,display_name,store_slug,plan,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id, email, name, storeSlug, "free", hash, salt, Date.now()).run();
          await db.prepare("INSERT INTO sessions (token_hash,seller_id,expires_at) VALUES (?,?,?)").bind(await digest(token).then(hex), id, Date.now() + WEEK * 1e3).run();
        } catch (error) {
          if (String(error).includes("UNIQUE")) return json({ error: "J\xE1 existe uma conta com esse e-mail." }, 409);
          throw error;
        }
        return json({ seller: { id, email, displayName: name, storeSlug, plan: "free" }, isAdmin: id === ADMIN_SELLER_ID }, 201, { "set-cookie": cookie(token, WEEK) });
      }
      if (url.pathname === "/api/login" && request.method === "POST") {
        const input = await body(request), email = normalizedEmail(input?.email), password = String(input?.password || "");
        if (email.length > 254 || password.length > 128) return json({ error: "E-mail ou senha incorretos." }, 401);
        const account = await db.prepare("SELECT id,email,display_name AS displayName,store_slug AS storeSlug,plan,password_hash AS passwordHash,password_salt AS passwordSalt FROM sellers WHERE email=?").bind(email).first();
        const candidate = await passwordHash(password, account?.passwordSalt || "00000000000000000000000000000000");
        if (!account || candidate !== account.passwordHash) return json({ error: "E-mail ou senha incorretos." }, 401);
        const token = randomToken();
        await db.prepare("INSERT INTO sessions (token_hash,seller_id,expires_at) VALUES (?,?,?)").bind(await digest(token).then(hex), account.id, Date.now() + WEEK * 1e3).run();
        return json({ seller: { id: account.id, email: account.email, displayName: account.displayName, storeSlug: account.storeSlug, plan: account.plan } }, 200, { "set-cookie": cookie(token, WEEK) });
      }
      if (url.pathname === "/api/password-reset" && request.method === "POST") {
        if (!env.RESEND_API_KEY || !env.MAIL_FROM) return json({ error: "A recupera\xE7\xE3o por e-mail ainda n\xE3o foi configurada." }, 503);
        const email = normalizedEmail((await body(request))?.email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Informe um e-mail v\xE1lido." }, 400);
        const account = await db.prepare("SELECT id,email FROM sellers WHERE email=?").bind(email).first();
        if (!account) return json({ ok: true }, 202);
        const now = Date.now(), recent = await db.prepare("SELECT created_at AS createdAt FROM password_resets WHERE seller_id=? ORDER BY created_at DESC LIMIT 1").bind(account.id).first();
        if (recent && now - recent.createdAt < RESET_COOLDOWN) return json({ ok: true }, 202);
        const token = randomToken(), tokenHash = await digest(token).then(hex), id = crypto.randomUUID();
        await db.prepare("DELETE FROM password_resets WHERE seller_id=?").bind(account.id).run();
        await db.prepare("INSERT INTO password_resets(id,seller_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)").bind(id, account.id, tokenHash, now, now + RESET_LIFETIME).run();
        const resetUrl = new URL("/", request.url);
        resetUrl.hash = new URLSearchParams({ token }).toString();
        let sent;
        try {
          sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to: [account.email], subject: "Redefina a senha da V\xE9rtice Motors", text: `Recebemos um pedido para redefinir a senha da sua conta V\xE9rtice Motors. Acesse este link em at\xE9 30 minutos: ${resetUrl.href}

Se voc\xEA n\xE3o pediu a redefini\xE7\xE3o, ignore este e-mail.`, html: `<p>Recebemos um pedido para redefinir a senha da sua conta V\xE9rtice Motors.</p><p><a href="${resetUrl.href}">Criar uma nova senha</a></p><p>O link expira em 30 minutos. Se voc\xEA n\xE3o pediu a redefini\xE7\xE3o, ignore este e-mail.</p>` }) });
        } catch {
          await db.prepare("DELETE FROM password_resets WHERE id=?").bind(id).run();
          return json({ error: "N\xE3o foi poss\xEDvel enviar o e-mail agora. Tente novamente." }, 502);
        }
        if (!sent.ok) {
          console.error("Password reset email provider returned status", sent.status);
          await db.prepare("DELETE FROM password_resets WHERE id=?").bind(id).run();
          return json({ error: "N\xE3o foi poss\xEDvel enviar o e-mail agora. Tente novamente." }, 502);
        }
        return json({ ok: true }, 202);
      }
      if (url.pathname === "/api/password-reset/complete" && request.method === "POST") {
        const input = await body(request), token = String(input?.token || ""), password = String(input?.password || "");
        if (!/^[\w-]{30,100}$/.test(token) || password.length < 12 || password.length > 128) return json({ error: "O link \xE9 inv\xE1lido ou expirou. Solicite uma nova redefini\xE7\xE3o." }, 400);
        const reset = await db.prepare("SELECT id,seller_id AS sellerId FROM password_resets WHERE token_hash=? AND expires_at>?").bind(await digest(token).then(hex), Date.now()).first();
        if (!reset) return json({ error: "O link \xE9 inv\xE1lido ou expirou. Solicite uma nova redefini\xE7\xE3o." }, 400);
        const salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await passwordHash(password, salt);
        await db.batch([db.prepare("UPDATE sellers SET password_hash=?,password_salt=? WHERE id=?").bind(hash, salt, reset.sellerId), db.prepare("DELETE FROM sessions WHERE seller_id=?").bind(reset.sellerId), db.prepare("DELETE FROM password_resets WHERE seller_id=?").bind(reset.sellerId)]);
        return json({ ok: true });
      }
      if (url.pathname === "/api/logout" && request.method === "POST") {
        const seller = await currentSeller(request, db);
        if (seller) await db.prepare("DELETE FROM sessions WHERE seller_id=?").bind(seller.id).run();
        return json({ seller: null }, 200, { "set-cookie": cookie("", 0) });
      }
      if (url.pathname === "/api/images" && request.method === "POST") {
        const seller = await currentSeller(request, db);
        if (!seller) return json({ error: "Entre na sua conta para enviar fotos." }, 401);
        if (!env.BUCKET) return json({ error: "O envio de fotos ainda n\xE3o est\xE1 dispon\xEDvel." }, 503);
        if (Number(request.headers.get("content-length") || 0) > 42e5) return json({ error: "A foto deve ter at\xE9 4 MB." }, 413);
        const data = await request.formData(), file = data.get("file");
        if (!(file instanceof File) || file.size < 16 || file.size > 4 * 1024 * 1024) return json({ error: "Escolha uma foto com at\xE9 4 MB." }, 400);
        const bytes = new Uint8Array(await file.arrayBuffer()), mime = file.type;
        let valid = false, extension = "";
        if (mime === "image/jpeg") {
          valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
          extension = "jpg";
        } else if (mime === "image/png") {
          valid = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
          extension = "png";
        } else if (mime === "image/webp") {
          valid = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
          extension = "webp";
        }
        if (!valid) return json({ error: "Envie uma foto JPEG, PNG ou WebP v\xE1lida." }, 415);
        const key = `cars/${seller.id}/${crypto.randomUUID()}.${extension}`;
        await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime, cacheControl: "public, max-age=3600" } });
        return json({ key }, 201);
      }
      if (url.pathname === "/api/listings" && request.method === "GET") {
        if (url.searchParams.get("mine") === "1") {
          const seller = await currentSeller(request, db);
          if (!seller) return json({ error: "Entre na sua conta." }, 401);
          const rows2 = await db.prepare("SELECT listings.id,listings.seller_id AS sellerId,listings.make,listings.model,listings.year,listings.mileage,listings.price,listings.location,listings.body_type AS bodyType,listings.image,listings.description,listings.whatsapp,listings.created_at AS createdAt,COALESCE(listing_metrics.views,0) AS views,COALESCE(listing_metrics.whatsapp_clicks,0) AS whatsappClicks FROM listings LEFT JOIN listing_metrics ON listing_metrics.listing_id=listings.id WHERE listings.seller_id=? ORDER BY listings.created_at DESC").bind(seller.id).all();
          return json({ listings: rows2.results.map((row) => ({ ...safeListing(row), views: row.views, whatsappClicks: row.whatsappClicks })) });
        }
        const rows = await db.prepare("SELECT listings.id,listings.seller_id AS sellerId,listings.make,listings.model,listings.year,listings.mileage,listings.price,listings.location,listings.body_type AS bodyType,listings.image,listings.description,listings.whatsapp,listings.created_at AS createdAt,sellers.display_name AS sellerName FROM listings JOIN sellers ON sellers.id=listings.seller_id ORDER BY listings.created_at DESC LIMIT 100").all();
        return json({ listings: rows.results });
      }
      if (url.pathname === "/api/listings" && request.method === "POST") {
        const seller = await currentSeller(request, db);
        if (!seller) return json({ error: "Entre na sua conta para publicar um ve\xEDculo." }, 401);
        const input = listingInput(await body(request));
        if (!input) return json({ error: "Confira as informa\xE7\xF5es. Use WhatsApp com c\xF3digo do pa\xEDs e DDD (55 + DDD + n\xFAmero)." }, 400);
        const id = crypto.randomUUID(), createdAt = Date.now();
        await db.prepare("INSERT INTO listings(id,seller_id,make,model,year,mileage,price,location,body_type,image,description,whatsapp,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, seller.id, input.make, input.model, input.year, input.mileage, input.price, input.location, input.bodyType, input.image, input.description, input.whatsapp, createdAt).run();
        return json({ listing: { id, ...input, sellerId: seller.id, createdAt, sellerName: seller.displayName } }, 201);
      }
      const listingMatch = url.pathname.match(/^\/api\/listings\/([\w-]+)$/);
      if (listingMatch && (request.method === "DELETE" || request.method === "PATCH")) {
        const seller = await currentSeller(request, db);
        if (!seller) return json({ error: "Entre na sua conta." }, 401);
        if (request.method === "DELETE") {
          const prior2 = await db.prepare("SELECT image FROM listings WHERE id=? AND seller_id=?").bind(listingMatch[1], seller.id).first();
          const result2 = await db.prepare("DELETE FROM listings WHERE id=? AND seller_id=?").bind(listingMatch[1], seller.id).run();
          if (result2.meta.changes && prior2?.image) await env.BUCKET?.delete(prior2.image);
          return result2.meta.changes ? json({ ok: true }) : json({ error: "O an\xFAncio n\xE3o foi encontrado." }, 404);
        }
        const input = listingInput(await body(request));
        if (!input) return json({ error: "Confira os dados do an\xFAncio." }, 400);
        const prior = await db.prepare("SELECT image FROM listings WHERE id=? AND seller_id=?").bind(listingMatch[1], seller.id).first();
        const result = await db.prepare("UPDATE listings SET make=?,model=?,year=?,mileage=?,price=?,location=?,body_type=?,image=?,description=?,whatsapp=? WHERE id=? AND seller_id=?").bind(input.make, input.model, input.year, input.mileage, input.price, input.location, input.bodyType, input.image, input.description, input.whatsapp, listingMatch[1], seller.id).run();
        if (result.meta.changes && prior?.image && prior.image !== input.image) await env.BUCKET?.delete(prior.image);
        return result.meta.changes ? json({ ok: true }) : json({ error: "O an\xFAncio n\xE3o foi encontrado." }, 404);
      }
      return json({ error: "Rota n\xE3o encontrada." }, 404);
    } catch (error) {
      console.error("Marketplace request failed", error);
      return json({ error: "N\xE3o foi poss\xEDvel concluir agora. Tente novamente." }, 500);
    }
  }
  return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Site indispon\xEDvel.", { status: 503 });
} };
export {
  index_default as default
};
