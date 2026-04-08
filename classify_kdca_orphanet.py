import csv
import json
import re
import tarfile
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
ORPHA_DIR = BASE_DIR / "orphadata"
KDCA_CSV = BASE_DIR / "kdca_희귀질환_전체목록.csv"
MANUAL_WHITELIST_CSV = BASE_DIR / "manual_primary_whitelist.csv"

OUTPUT_CSV = BASE_DIR / "kdca_희귀질환_진료과분류_orphanet_hybrid.csv"
UNMATCHED_CSV = BASE_DIR / "kdca_희귀질환_진료과분류_orphanet_hybrid_미분류.csv"
SUMMARY_MD = BASE_DIR / "kdca_희귀질환_진료과분류_orphanet_hybrid_요약.md"


CLASSIFICATION_TO_SPECIALTY = {
    "en_product3_146.xml": "심장내과/소아심장과",
    "en_product3_148.xml": "심장내과/소아심장과",
    "en_product3_150.xml": "내분비대사내과",
    "en_product3_152.xml": "소화기내과",
    "en_product3_181.xml": "신경과",
    "en_product3_183.xml": "소화기내과",
    "en_product3_184.xml": "호흡기내과",
    "en_product3_185.xml": "비뇨의학과",
    "en_product3_187.xml": "피부과",
    "en_product3_188.xml": "신장내과",
    "en_product3_189.xml": "안과",
    "en_product3_193.xml": "내분비대사내과",
    "en_product3_194.xml": "혈액종양내과",
    "en_product3_195.xml": "류마티스내과/면역내과",
    "en_product3_196.xml": "류마티스내과/면역내과",
    "en_product3_197.xml": "치과/구강악안면외과",
    "en_product3_198.xml": "심장내과/소아심장과",
    "en_product3_199.xml": "정형외과",
    "en_product3_200.xml": "이비인후과",
    "en_product3_201.xml": "산부인과/생식의학",
    "en_product3_202.xml": "혈액종양내과",
    "en_product3_205.xml": "산부인과/생식의학",
    "en_product3_209.xml": "치과/구강악안면외과",
    "en_product3_231.xml": "소아청소년과/의학유전학",
}


PARENT_KEYWORDS = [
    ("ophthalm", "안과"),
    ("neurolog", "신경과"),
    ("renal", "신장내과"),
    ("urogenital", "비뇨의학과"),
    ("cardiac", "심장내과/소아심장과"),
    ("circulatory", "심장내과/소아심장과"),
    ("gastro", "소화기내과"),
    ("hepatic", "소화기내과"),
    ("respir", "호흡기내과"),
    ("endocrine", "내분비대사내과"),
    ("metabolism", "내분비대사내과"),
    ("haematolog", "혈액종양내과"),
    ("neoplastic", "혈액종양내과"),
    ("immunolog", "류마티스내과/면역내과"),
    ("rheumat", "류마티스내과/면역내과"),
    ("allergic", "류마티스내과/면역내과"),
    ("skin", "피부과"),
    ("bone", "정형외과"),
    ("otorhinolaryng", "이비인후과"),
    ("odontolog", "치과/구강악안면외과"),
    ("maxillo", "치과/구강악안면외과"),
    ("gynaec", "산부인과/생식의학"),
    ("obstetric", "산부인과/생식의학"),
    ("infertility", "산부인과/생식의학"),
    ("developmental anomalies", "소아청소년과/의학유전학"),
    ("genetic", "소아청소년과/의학유전학"),
    ("childhood", "소아청소년과/의학유전학"),
]


def normalize_name(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[\[\]\(\)\{\},;:/']", " ", text)
    text = re.sub(r"[-_]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_code(code: str) -> str:
    code = (code or "").strip().upper()
    if code in {"", "없음", "NONE", "N/A"}:
        return ""
    return code


def normalize_korean(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"\s+", "", text)
    return text


def get_json_data(path: Path) -> dict:
    with tarfile.open(path, "r:gz") as tar:
        member = tar.getmembers()[0]
        return json.loads(tar.extractfile(member).read())


def label_from_name_block(value) -> str:
    if isinstance(value, list) and value:
        first = value[0]
        if isinstance(first, dict):
            return first.get("label", "")
    if isinstance(value, dict):
        return value.get("label", "")
    return ""


def load_orphanet_disorders():
    data = get_json_data(ORPHA_DIR / "en_product1.json.tar.gz")
    disorders = {}
    preferred_index = defaultdict(set)
    synonym_index = defaultdict(set)
    icd10_index = defaultdict(set)

    disorder_list = data["JDBOR"][0]["DisorderList"][0]["Disorder"]
    for disorder in disorder_list:
        orpha = disorder["OrphaCode"]
        pref_name = label_from_name_block(disorder.get("Name"))
        synonyms = []
        if disorder.get("SynonymList"):
            for syn in disorder["SynonymList"][0].get("Synonym", []):
                synonyms.append(syn.get("label", ""))

        icd10_codes = set()
        for ext_group in disorder.get("ExternalReferenceList", []):
            for ext in ext_group.get("ExternalReference", []):
                if ext.get("Source") == "ICD-10":
                    ref = normalize_code(ext.get("Reference", ""))
                    if ref:
                        icd10_codes.add(ref)
                        icd10_index[ref].add(orpha)

        pref_norm = normalize_name(pref_name)
        if pref_norm:
            preferred_index[pref_norm].add(orpha)
            synonym_index[pref_norm].add(orpha)
        for syn in synonyms:
            syn_norm = normalize_name(syn)
            if syn_norm:
                synonym_index[syn_norm].add(orpha)

        disorders[orpha] = {
            "orpha_code": orpha,
            "name": pref_name,
            "name_norm": pref_norm,
            "synonyms": synonyms,
            "icd10_codes": icd10_codes,
        }

    return disorders, preferred_index, synonym_index, icd10_index


def walk_classification_nodes(node, codes: set):
    disorder = node.find("Disorder")
    if disorder is not None:
        code = disorder.findtext("OrphaCode", default="").strip()
        if code:
            codes.add(code)
    child_list = node.find("ClassificationNodeChildList")
    if child_list is not None:
        for child in child_list.findall("ClassificationNode"):
            walk_classification_nodes(child, codes)


def load_specialty_memberships():
    memberships = defaultdict(set)
    sources = defaultdict(set)
    for filename, specialty in CLASSIFICATION_TO_SPECIALTY.items():
        path = ORPHA_DIR / filename
        if not path.exists():
            continue
        root = ET.parse(path).getroot()
        for node in root.findall(".//ClassificationNodeRootList/ClassificationNode"):
            codes = set()
            walk_classification_nodes(node, codes)
            for code in codes:
                memberships[code].add(specialty)
                sources[code].add(filename)
    return memberships, sources


def load_manual_whitelist():
    rules = []
    with MANUAL_WHITELIST_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            rules.append(row)
    return rules


def apply_manual_primary_whitelist(korean_name: str, english_name: str, rules):
    english_norm = normalize_name(english_name)
    korean_norm = normalize_korean(korean_name)
    for rule in rules:
        field = rule["match_field"]
        pattern = rule["pattern"]
        if field == "english":
            if re.search(pattern, english_norm):
                return rule["specialty"], pattern
        elif field == "korean":
            if pattern.replace(" ", "") in korean_norm:
                return rule["specialty"], pattern
    return "", ""


def map_parent_to_specialty(parent_name: str) -> str:
    parent_norm = normalize_name(parent_name)
    for keyword, specialty in PARENT_KEYWORDS:
        if keyword in parent_norm:
            return specialty
    return ""


def load_preferential_parents():
    path = ORPHA_DIR / "en_product7.xml"
    root = ET.parse(path).getroot()
    parent_map = {}
    for disorder in root.findall(".//Disorder"):
        code = disorder.findtext("OrphaCode", default="").strip()
        assoc_list = disorder.find("DisorderDisorderAssociationList")
        if not code or assoc_list is None:
            continue
        for assoc in assoc_list.findall("DisorderDisorderAssociation"):
            assoc_type = assoc.findtext("DisorderDisorderAssociationType/Name", default="")
            if assoc_type != "Preferential parent":
                continue
            target_name = assoc.findtext("TargetDisorder/Name", default="").strip()
            target_code = assoc.findtext("TargetDisorder/OrphaCode", default="").strip()
            if target_name:
                parent_map[code] = {
                    "parent_name": target_name,
                    "parent_code": target_code,
                    "primary_specialty": map_parent_to_specialty(target_name),
                }
                break
    return parent_map


def choose_orpha_match(english_name: str, kcd_code: str, preferred_index, synonym_index, icd10_index, disorders):
    name_norm = normalize_name(english_name)
    code_norm = normalize_code(kcd_code)
    pref = set(preferred_index.get(name_norm, set()))
    syn = set(synonym_index.get(name_norm, set()))
    code_matches = set(icd10_index.get(code_norm, set())) if code_norm else set()

    if len(pref) == 1:
        candidate = next(iter(pref))
        if not code_matches or candidate in code_matches:
            return candidate, "preferred_name_exact"
        return "", "name_code_conflict"

    if len(syn) == 1:
        candidate = next(iter(syn))
        if not code_matches or candidate in code_matches:
            return candidate, "synonym_exact"
        return "", "name_code_conflict"

    if pref and code_matches:
        inter = pref & code_matches
        if len(inter) == 1:
            return next(iter(inter)), "preferred_name_plus_kcd"
        return "", "ambiguous_name_code"

    if syn and code_matches:
        inter = syn & code_matches
        if len(inter) == 1:
            return next(iter(inter)), "synonym_plus_kcd"
        return "", "ambiguous_name_code"

    return "", "no_conservative_match"


def main():
    disorders, preferred_index, synonym_index, icd10_index = load_orphanet_disorders()
    memberships, membership_sources = load_specialty_memberships()
    parent_map = load_preferential_parents()
    manual_rules = load_manual_whitelist()

    rows = list(csv.DictReader(KDCA_CSV.open("r", encoding="utf-8-sig", newline="")))

    output_rows = []
    unmatched_rows = []
    matched_count = 0
    primary_counter = Counter()
    method_counter = Counter()

    for row in rows:
        orpha_code, method = choose_orpha_match(
            row.get("EnglishName", ""),
            row.get("KCD", ""),
            preferred_index,
            synonym_index,
            icd10_index,
            disorders,
        )
        method_counter[method] += 1

        if not orpha_code:
            manual_specialty, manual_rule = apply_manual_primary_whitelist(
                row.get("KoreanName", ""),
                row.get("EnglishName", ""),
                manual_rules,
            )
            output_rows.append({
                **row,
                "OrphaCode": "",
                "OrphaName": "",
                "MatchMethod": method,
                "PrimarySpecialty": manual_specialty if manual_specialty else "미분류",
                "RelatedSpecialties": "",
                "AllSpecialties": manual_specialty if manual_specialty else "",
                "ClassificationSource": f"manual_primary_whitelist:{manual_rule}" if manual_specialty else "",
                "PreferentialParent": "",
                "Status": "분류완료" if manual_specialty else "미분류",
            })
            if manual_specialty:
                primary_counter[manual_specialty] += 1
            else:
                unmatched_rows.append({
                    **row,
                    "UnmatchedReason": method,
                })
            continue

        matched_count += 1
        orpha = disorders[orpha_code]
        specialties = sorted(memberships.get(orpha_code, set()))
        parent = parent_map.get(orpha_code, {})
        primary = parent.get("primary_specialty", "")

        if primary and primary not in specialties:
            specialties = [primary] + specialties
        if not primary and len(specialties) == 1:
            primary = specialties[0]

        if primary:
            related = [s for s in specialties if s != primary]
            status = "분류완료"
            primary_counter[primary] += 1
        elif specialties:
            related = specialties
            status = "리뷰필요"
        else:
            related = []
            status = "미분류"

        output_rows.append({
            **row,
            "OrphaCode": orpha_code,
            "OrphaName": orpha["name"],
            "MatchMethod": method,
            "PrimarySpecialty": primary if primary else ("미분류" if not specialties else ""),
            "RelatedSpecialties": "; ".join(related),
            "AllSpecialties": "; ".join(specialties),
            "ClassificationSource": "; ".join(sorted(membership_sources.get(orpha_code, set()))),
            "PreferentialParent": parent.get("parent_name", ""),
            "Status": status,
        })

        if status != "분류완료":
            unmatched_rows.append({
                **row,
                "UnmatchedReason": "no_primary_specialty" if specialties else "no_specialty_membership",
            })

    fieldnames = [
        "No", "KoreanName", "EnglishName", "KCD", "VCode", "Support",
        "OrphaCode", "OrphaName", "MatchMethod", "PrimarySpecialty",
        "RelatedSpecialties", "AllSpecialties", "ClassificationSource",
        "PreferentialParent", "Status",
    ]
    with OUTPUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    with UNMATCHED_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["No", "KoreanName", "EnglishName", "KCD", "VCode", "Support", "UnmatchedReason"])
        writer.writeheader()
        writer.writerows(unmatched_rows)

    status_counter = Counter(r["Status"] for r in output_rows)
    lines = [
        "# KDCA 희귀질환 Orphanet 기반 진료과 분류 요약",
        "",
        "- 출처: Orphadata `en_product1`, `en_product7`, specialty classification XMLs",
        "- 원칙: 영문 질환명 exact match와 KCD 충돌 검사를 통과한 경우만 보수적으로 매핑",
        "- 애매하거나 근거가 약한 항목은 `미분류` 또는 `리뷰필요`로 유지",
        "- 보완 규칙: Orphanet 미매핑 항목 중 질환명에서 주진료과가 매우 명확한 경우에만 `manual_primary_whitelist`로 주진료과 1개를 부여",
        f"- 전체 KDCA 질환 수: {len(output_rows)}",
        f"- OrphaCode 보수 매핑 성공 수: {matched_count}",
        "",
        "## 상태 분포",
        "",
        "| 상태 | 건수 |",
        "|---|---:|",
    ]
    for status, count in status_counter.most_common():
        lines.append(f"| {status} | {count} |")

    lines.extend([
        "",
        "## 주진료과 분포",
        "",
        "| 주진료과 | 건수 |",
        "|---|---:|",
    ])
    for specialty, count in primary_counter.most_common():
        lines.append(f"| {specialty} | {count} |")

    lines.extend([
        "",
        "## 매핑 방법 분포",
        "",
        "| 매핑 방법 | 건수 |",
        "|---|---:|",
    ])
    for method, count in method_counter.most_common():
        lines.append(f"| {method} | {count} |")

    lines.extend([
        "",
        "## 비고",
        "",
        "- `분류완료`: OrphaCode 매핑과 진료과 분류가 모두 확보된 항목",
        "- `리뷰필요`: OrphaCode는 잡혔지만 대표 진료과를 보수적으로 확정하지 않은 항목",
        "- `미분류`: OrphaCode 자체를 보수 기준으로 확정하지 못했거나 specialty membership이 없는 항목",
    ])
    SUMMARY_MD.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
