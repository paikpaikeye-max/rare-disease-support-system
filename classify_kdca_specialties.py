import csv
import re
from collections import Counter
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
INPUT_CSV = BASE_DIR / "kdca_희귀질환_전체목록.csv"
OUTPUT_CSV = BASE_DIR / "kdca_희귀질환_진료과분류.csv"
SUMMARY_MD = BASE_DIR / "kdca_희귀질환_진료과분류_요약.md"


RULES = [
    {
        "specialty": "안과",
        "priority": 100,
        "patterns": [
            r"망막", r"황반", r"맥락막", r"각막", r"수정체", r"홍채", r"포도막", r"유리체", r"시신경",
            r"시각", r"시력", r"실명", r"안구", r"안검", r"결막", r"안와", r"녹내장", r"백내장",
            r"소안구", r"무홍채", r"원추각막", r"retin", r"macul", r"choroid", r"cornea",
            r"lens", r"iris", r"uve", r"optic", r"ocular", r"ophthalm", r"eye", r"glaucoma",
            r"cataract", r"kerato", r"aniridia", r"microphthalm",
        ],
    },
    {
        "specialty": "신경과",
        "priority": 95,
        "patterns": [
            r"뇌", r"소뇌", r"척수", r"신경", r"경련", r"간질", r"운동실조", r"근위축", r"근디스트로피",
            r"마비", r"치매", r"정신운동지체", r"신경병", r"뇌병증", r"발작", r"백질", r"중추신경",
            r"neu", r"cereb", r"spinal", r"epile", r"ataxia", r"dystrophy", r"neuropathy",
            r"encephal", r"myopath", r"paralysis", r"seizure",
        ],
    },
    {
        "specialty": "소아청소년과/의학유전학",
        "priority": 90,
        "patterns": [
            r"증후군", r"삼염색체", r"단일염색체", r"결손", r"중복", r"미세결손", r"미세중복", r"염색체",
            r"선천성", r"태아", r"발달장애", r"발달지연", r"지적", r"희귀", r"유전", r"관련 .* 증후군",
            r"syndrome", r"trisomy", r"monosomy", r"deletion", r"duplication", r"microdeletion",
            r"microduplication", r"chromosome", r"congenital", r"fetal", r"developmental disorder",
            r"genetic", r"inherited",
        ],
    },
    {
        "specialty": "심장내과/소아심장과",
        "priority": 88,
        "patterns": [
            r"심장", r"심실", r"심방", r"대동맥", r"판막", r"승모판", r"폐동맥", r"정맥", r"혈관", r"심근",
            r"부정맥", r"심근병", r"심혈관", r"card", r"aort", r"ventric", r"atri", r"valve",
            r"mitral", r"arter", r"ven", r"myocard", r"arrhythm", r"vascular",
        ],
    },
    {
        "specialty": "호흡기내과",
        "priority": 86,
        "patterns": [
            r"폐", r"기관지", r"호흡", r"기도", r"폐포", r"폐동맥고혈압", r"천식", r"호흡부전",
            r"lung", r"pulmo", r"bronch", r"respir", r"airway", r"alveol", r"asthma",
        ],
    },
    {
        "specialty": "소화기내과",
        "priority": 84,
        "patterns": [
            r"간경변", r"간담도", r"담도", r"췌장", r"식도", r"직장", r"대장", r"소장", r"위장", r"장염", r"장폐색", r"장관",
            r"간질환", r"간부전", r"간섬유화", r"췌", r"췌장염",
            r"liver", r"hepato", r"biliary", r"pancrea", r"stomach", r"gastr", r"intestin",
            r"colon", r"rect", r"esoph",
        ],
    },
    {
        "specialty": "신장내과",
        "priority": 83,
        "patterns": [
            r"신장", r"콩팥", r"사구체", r"세뇨관", r"요관", r"방광", r"신증", r"신염", r"신부전", r"다낭신",
            r"kidney", r"renal", r"neph", r"glomer", r"tubul", r"ureter", r"bladder",
        ],
    },
    {
        "specialty": "내분비대사내과",
        "priority": 82,
        "patterns": [
            r"대사", r"당원", r"지질", r"지방산", r"미토콘드리아", r"갑상선", r"부신", r"성장호르몬",
            r"당뇨", r"저혈당", r"대사이상", r"metab", r"glycogen", r"lipid", r"fatty acid",
            r"mitochond", r"thyroid", r"adrenal", r"hormone", r"diabet", r"hypogly",
        ],
    },
    {
        "specialty": "혈액종양내과",
        "priority": 81,
        "patterns": [
            r"혈액", r"빈혈", r"백혈병", r"림프", r"골수", r"혈소판", r"호중구", r"응고", r"혈우",
            r"hem", r"anemi", r"leuk", r"lymph", r"myelo", r"platelet", r"neutrop", r"coagul",
        ],
    },
    {
        "specialty": "류마티스내과/면역내과",
        "priority": 80,
        "patterns": [
            r"자가면역", r"염증", r"관절염", r"루푸스", r"베체트", r"쉐그렌", r"사르코이드", r"면역",
            r"rheum", r"arthrit", r"lupus", r"behcet", r"sjogren", r"sarcoid", r"immune", r"autoimmune",
        ],
    },
    {
        "specialty": "피부과",
        "priority": 79,
        "patterns": [
            r"피부", r"표피", r"외배엽", r"모발", r"손발톱", r"수포", r"각화", r"색소", r"피부염",
            r"skin", r"epiderm", r"ectoderm", r"hair", r"nail", r"blister", r"kerat", r"pigment", r"dermat",
        ],
    },
    {
        "specialty": "이비인후과",
        "priority": 78,
        "patterns": [
            r"귀", r"청력", r"난청", r"이도", r"중이", r"비강", r"코", r"후두", r"성대", r"청각",
            r"ear", r"hearing", r"deaf", r"auditory", r"ot", r"nas", r"rhino", r"laryn", r"vocal",
        ],
    },
    {
        "specialty": "정형외과",
        "priority": 77,
        "patterns": [
            r"골", r"뼈", r"관절", r"척추", r"연골", r"사지", r"골격", r"골형성", r"골이형성",
            r"bone", r"skelet", r"joint", r"spine", r"cartilage", r"limb", r"dysplasia", r"oste",
        ],
    },
    {
        "specialty": "산부인과/생식의학",
        "priority": 76,
        "patterns": [
            r"난소", r"자궁", r"태반", r"생식", r"불임", r"고환", r"음경", r"난관", r"월경",
            r"ovar", r"uter", r"placent", r"reproduct", r"fertil", r"testic", r"peni", r"fallopian", r"menstru",
        ],
    },
    {
        "specialty": "비뇨의학과",
        "priority": 75,
        "patterns": [
            r"요도", r"배뇨", r"비뇨", r"전립선", r"uro", r"ureth", r"mictur", r"prostat",
        ],
    },
    {
        "specialty": "치과/구강악안면외과",
        "priority": 74,
        "patterns": [
            r"치아", r"치", r"턱", r"구개", r"구순", r"구강", r"잇몸",
            r"tooth", r"dental", r"jaw", r"palat", r"cleft lip", r"oral", r"gingiv",
        ],
    },
]


SPECIALTY_ORDER = [rule["specialty"] for rule in sorted(RULES, key=lambda x: -x["priority"])]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def classify(record: dict) -> dict:
    combined = f'{record["KoreanName"]} {record["EnglishName"]}'.lower()
    matched = []
    reasons = {}

    for rule in RULES:
        hits = []
        for pattern in rule["patterns"]:
            if re.search(pattern.lower(), combined):
                hits.append(pattern)
        if hits:
            matched.append(rule["specialty"])
            reasons[rule["specialty"]] = ", ".join(hits[:4])

    if not matched:
        matched.append("미분류")
        reasons["미분류"] = "명시적 진료과 키워드 미검출"

    ordered = sorted(
        matched,
        key=lambda s: SPECIALTY_ORDER.index(s) if s in SPECIALTY_ORDER else 999
    )
    organ_first = [s for s in ordered if s not in {"소아청소년과/의학유전학", "미분류"}]
    primary = organ_first[0] if organ_first else ordered[0]
    secondary = [s for s in ordered if s != primary][:3]

    direct_organ_specialties = [s for s in ordered if s not in {"소아청소년과/의학유전학", "미분류"}]
    if len(direct_organ_specialties) >= 2:
        confidence = "중"
    elif len(direct_organ_specialties) == 1:
        confidence = "중상"
    elif primary == "소아청소년과/의학유전학":
        confidence = "하"
    elif primary == "미분류":
        confidence = "하"
    else:
        confidence = "중"

    return {
        "PrimarySpecialty": primary,
        "RelatedSpecialties": "; ".join(secondary),
        "AllSpecialties": "; ".join(ordered),
        "Reason": " | ".join(f"{s}: {reasons[s]}" for s in ordered if s in reasons),
        "Confidence": confidence,
    }


def main() -> None:
    rows = list(csv.DictReader(INPUT_CSV.open("r", encoding="utf-8-sig", newline="")))
    out_rows = []
    counter_primary = Counter()
    counter_any = Counter()

    for row in rows:
        row = {k: normalize(v) for k, v in row.items()}
        result = classify(row)
        merged = {**row, **result}
        out_rows.append(merged)
        counter_primary[result["PrimarySpecialty"]] += 1
        for specialty in result["AllSpecialties"].split("; "):
            counter_any[specialty] += 1

    fieldnames = [
        "No",
        "KoreanName",
        "EnglishName",
        "KCD",
        "VCode",
        "Support",
        "PrimarySpecialty",
        "RelatedSpecialties",
        "AllSpecialties",
        "Confidence",
        "Reason",
    ]
    with OUTPUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    lines = [
        "# KDCA 희귀질환 진료과 분류 요약",
        "",
        "- 기준 파일: `kdca_희귀질환_전체목록.csv`",
        f"- 전체 질환 수: {len(out_rows)}",
        "- 분류 방식: 질환명 한글/영문 기반 키워드 규칙 분류",
        "- 원칙: 모든 질환에 공통으로 `희귀질환 기본분류`를 붙이지 않고, 질환명에 근거가 있을 때만 `소아청소년과/의학유전학`을 부여했습니다.",
        "- 주의: 실제 진료 현장에서는 다중 진료과 연계가 필요하므로, 자동 분류 결과는 초안으로 사용하고 의사 검토를 거치는 것이 안전합니다.",
        "",
        "## 주진료과 분포",
        "",
        "| 주진료과 | 건수 |",
        "|---|---:|",
    ]
    for specialty, count in counter_primary.most_common():
        lines.append(f"| {specialty} | {count} |")

    lines.extend([
        "",
        "## 관련과 포함 전체 등장 빈도",
        "",
        "| 진료과 | 포함 건수 |",
        "|---|---:|",
    ])
    for specialty, count in counter_any.most_common():
        lines.append(f"| {specialty} | {count} |")

    lines.extend([
        "",
        "## 비고",
        "",
        "- `PrimarySpecialty`: 웹 화면에서 기본 선택 과로 쓰기 위한 대표 과",
        "- `RelatedSpecialties`: 협진 또는 추가 선택 후보",
        "- `AllSpecialties`: 검색 필터용 전체 매핑",
        "- `Confidence`: 규칙 기반 자동 분류 신뢰도",
        "- `미분류`: 질환명만으로 특정 진료과를 안전하게 확정하기 어려운 항목",
    ])
    SUMMARY_MD.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
