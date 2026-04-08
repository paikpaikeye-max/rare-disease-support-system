const { json, mapDisease, supabaseFetch } = require("./_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const response = await supabaseFetch("/rest/v1/diseases?select=pk,primary_specialty,all_specialties&order=pk.asc&limit=5000", {}, false);
  if (!response.ok) {
    const message = await response.text();
    return json(res, response.status, { error: message });
  }

  const specialtySet = new Set();
  const rows = await response.json();
  rows.map(mapDisease).forEach((disease) => {
    if (disease.primarySpecialty && disease.primarySpecialty !== "미분류") {
      specialtySet.add(disease.primarySpecialty);
    }
    (disease.allSpecialties || []).forEach((specialty) => {
      if (specialty && specialty !== "미분류") {
        specialtySet.add(specialty);
      }
    });
  });

  return json(res, 200, {
    items: [...specialtySet].sort((a, b) => a.localeCompare(b, "ko")),
  });
};
