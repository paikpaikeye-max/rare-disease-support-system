const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getProjectUrl() {
  if (!SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL");
  }
  return SUPABASE_URL.replace(/\/$/, "");
}

function getHeaders(useServiceRole = false) {
  const apikey = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  if (!apikey) {
    throw new Error(useServiceRole ? "Missing SUPABASE_SERVICE_ROLE_KEY" : "Missing SUPABASE_ANON_KEY");
  }
  return {
    apikey,
    Authorization: `Bearer ${apikey}`,
    "Content-Type": "application/json",
  };
}

function mapDisease(row) {
  return {
    id: String(row.pk),
    sourceNo: row.source_no || "",
    koreanName: row.korean_name || "",
    englishName: row.english_name || "",
    kcd: row.kcd || "",
    vcode: row.vcode || "",
    support: row.support || "",
    primarySpecialty: row.primary_specialty || "미분류",
    allSpecialties: Array.isArray(row.all_specialties) ? row.all_specialties : [],
    classificationSource: row.classification_source || "",
    status: row.status || "",
    orphaCode: row.orpha_code || "",
    orphaName: row.orpha_name || "",
  };
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function supabaseFetch(path, options = {}, useServiceRole = false) {
  const response = await fetch(`${getProjectUrl()}${path}`, {
    ...options,
    headers: {
      ...getHeaders(useServiceRole),
      ...(options.headers || {}),
    },
  });
  return response;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

module.exports = {
  SUPABASE_URL,
  mapDisease,
  json,
  readJsonBody,
  supabaseFetch,
};
