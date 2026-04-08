const { json, mapDisease, supabaseFetch } = require("./_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const search = String(req.query.search || "").trim().toLowerCase();
  const specialty = String(req.query.specialty || "").trim();

  const response = await supabaseFetch("/rest/v1/diseases?select=*&order=pk.asc&limit=5000", {}, false);
  if (!response.ok) {
    const message = await response.text();
    return json(res, response.status, { error: message });
  }

  let items = (await response.json()).map(mapDisease);
  if (search) {
    items = items.filter((disease) => [
      disease.koreanName,
      disease.englishName,
      disease.kcd,
      disease.vcode,
      disease.primarySpecialty,
      disease.orphaName,
      disease.support,
      (disease.allSpecialties || []).join(" "),
    ].join(" ").toLowerCase().includes(search));
  }
  if (specialty) {
    items = items.filter((disease) => (disease.allSpecialties || []).includes(specialty));
  }

  return json(res, 200, { items });
};
