# KDCA 희귀질환 Orphanet 기반 진료과 분류 요약

- 출처: Orphadata `en_product1`, `en_product7`, specialty classification XMLs
- 원칙: 영문 질환명 exact match와 KCD 충돌 검사를 통과한 경우만 보수적으로 매핑
- 애매하거나 근거가 약한 항목은 `미분류` 또는 `리뷰필요`로 유지
- 보완 규칙: Orphanet 미매핑 항목 중 질환명에서 주진료과가 매우 명확한 경우에만 `manual_primary_whitelist`로 주진료과 1개를 부여
- 전체 KDCA 질환 수: 1413
- OrphaCode 보수 매핑 성공 수: 354

## 상태 분포

| 상태 | 건수 |
|---|---:|
| 미분류 | 1013 |
| 분류완료 | 315 |
| 리뷰필요 | 85 |

## 주진료과 분포

| 주진료과 | 건수 |
|---|---:|
| 신경과 | 109 |
| 내분비대사내과 | 39 |
| 정형외과 | 31 |
| 심장내과/소아심장과 | 28 |
| 안과 | 24 |
| 류마티스내과/면역내과 | 21 |
| 피부과 | 18 |
| 신장내과 | 17 |
| 소화기내과 | 12 |
| 혈액종양내과 | 8 |
| 호흡기내과 | 4 |
| 이비인후과 | 3 |
| 치과/구강악안면외과 | 1 |

## 매핑 방법 분포

| 매핑 방법 | 건수 |
|---|---:|
| no_conservative_match | 1032 |
| preferred_name_exact | 272 |
| synonym_exact | 82 |
| name_code_conflict | 27 |

## 비고

- `분류완료`: OrphaCode 매핑과 진료과 분류가 모두 확보된 항목
- `리뷰필요`: OrphaCode는 잡혔지만 대표 진료과를 보수적으로 확정하지 않은 항목
- `미분류`: OrphaCode 자체를 보수 기준으로 확정하지 못했거나 specialty membership이 없는 항목