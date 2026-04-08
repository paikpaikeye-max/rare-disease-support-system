const { json, mapDisease, readJsonBody, supabaseFetch } = require("./_lib/supabase");

async function fetchDiseaseByPk(pk) {
  const response = await supabaseFetch(`/rest/v1/diseases?pk=eq.${encodeURIComponent(pk)}&select=*`, {}, true);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const items = await response.json();
  return items[0] || null;
}

async function updateDiseaseByPk(pk, payload) {
  const response = await supabaseFetch(`/rest/v1/diseases?pk=eq.${encodeURIComponent(pk)}&select=*`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  }, true);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const items = await response.json();
  return items[0] || null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const body = await readJsonBody(req);
  const password = String(req.headers["x-admin-password"] || body.password || "");
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return json(res, 403, { error: "Invalid password" });
  }

  const action = String(body.action || "");
  const diseaseId = String(body.diseaseId || "");
  const specialty = String(body.specialty || "").trim();
  if (!action || !diseaseId) {
    return json(res, 400, { error: "action and diseaseId are required" });
  }

  const disease = await fetchDiseaseByPk(diseaseId);
  if (!disease) {
    return json(res, 404, { error: "Disease not found" });
  }

  const allSpecialties = Array.isArray(disease.all_specialties) ? [...disease.all_specialties] : [];

  if (action === "setPrimary") {
    if (!specialty) {
      return json(res, 400, { error: "specialty is required" });
    }
    if (!allSpecialties.includes(specialty)) {
      allSpecialties.push(specialty);
      allSpecialties.sort((a, b) => a.localeCompare(b, "ko"));
    }
    const updated = await updateDiseaseByPk(diseaseId, {
      primary_specialty: specialty,
      all_specialties: allSpecialties,
    });
    return json(res, 200, mapDisease(updated));
  }

  if (action === "addSpecialty") {
    if (!specialty) {
      return json(res, 400, { error: "specialty is required" });
    }
    if (!allSpecialties.includes(specialty)) {
      allSpecialties.push(specialty);
      allSpecialties.sort((a, b) => a.localeCompare(b, "ko"));
    }
    const payload = { all_specialties: allSpecialties };
    if (!disease.primary_specialty || disease.primary_specialty === "미분류") {
      payload.primary_specialty = specialty;
    }
    const updated = await updateDiseaseByPk(diseaseId, payload);
    return json(res, 200, mapDisease(updated));
  }

  if (action === "removeSpecialty") {
    const nextSpecialties = allSpecialties.filter((item) => item !== specialty);
    const payload = {
      all_specialties: nextSpecialties,
    };
    if (disease.primary_specialty === specialty) {
      payload.primary_specialty = nextSpecialties[0] || "미분류";
    }
    const updated = await updateDiseaseByPk(diseaseId, payload);
    return json(res, 200, mapDisease(updated));
  }

  return json(res, 400, { error: "Unsupported action" });
};
