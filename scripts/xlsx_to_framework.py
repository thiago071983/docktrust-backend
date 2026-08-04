#!/usr/bin/env python3
"""
Converte o Dock Trust Framework (xlsx) para o JSON estruturado que o backend
consome (pillars > controls > questions).

É a ÚNICA forma correta de atualizar o banco de perguntas: quando o time de
produto editar a planilha, rode este script de novo — nunca edite o JSON
gerado nem o seed TS à mão, ou a próxima geração vai sobrescrever a edição
manual sem avisar.

Uso:
    python3 xlsx_to_framework.py <caminho_do_xlsx> <diretorio_de_saida>
"""

import sys
import json
import pandas as pd

# Mapeia o texto integral da coluna "Condição de aplicação" (perguntas tipo
# Condicional) para uma chave estável e curta — é essa chave que vira o
# campo booleano que a instituição responde no onboarding/config de perfil.
# Se a planilha ganhar uma condição nova que não está aqui, o script FALHA
# de propósito (ver checagem no final) — mais seguro que silenciosamente
# marcar como "sem condição mapeada".
CONDITION_TEXT_TO_KEY = {
    "Aplicar quando a organização contratar terceiros, manter parceiros ou depender de serviços externos relevantes.": "USES_THIRD_PARTIES",
    "Aplicar quando a organização estiver sujeita a obrigações de PLD/FTP ou participar de fluxos financeiros regulados.": "SUBJECT_TO_AML_CFT",
    "Aplicar quando a organização cadastrar, identificar ou manter relacionamento com clientes, usuários, lojistas ou beneficiários.": "HAS_CUSTOMER_RELATIONSHIP",
    "Aplicar quando a organização desenvolver, customizar ou manter aplicações, APIs, automações ou componentes de software.": "DEVELOPS_SOFTWARE",
    "Aplicar quando a organização oferecer, autorizar, processar ou monitorar transações financeiras.": "PROCESSES_TRANSACTIONS",
    "Aplicar quando a organização tratar dados pessoais ou dados pessoais sensíveis.": "PROCESSES_PERSONAL_DATA",
    "Aplicar quando a organização desenvolver, contratar ou utilizar sistemas e modelos de inteligência artificial.": "USES_AI",
    "Aplicar quando a organização consumir, disponibilizar ou operar APIs.": "USES_OR_EXPOSES_APIS",
    "Aplicar quando a organização disponibilizar aplicações ou canais digitais para clientes, parceiros ou colaboradores.": "OFFERS_DIGITAL_CHANNELS",
    "Aplicar quando a organização oferecer, processar ou suportar operações Pix.": "OPERATES_PIX",
    "Aplicar quando a organização utilizar serviços de computação em nuvem.": "USES_CLOUD",
    "Aplicar quando houver função de Auditoria Interna própria, compartilhada ou terceirizada, ou exigência regulatória equivalente.": "HAS_INTERNAL_AUDIT",
}

PILLAR_CODE_TO_META = {
    "TG": {"id": "pillar-T-governance", "code": "T1", "name": "Trust Governance", "color": "#3b82f6"},
    "RO": {"id": "pillar-R-operations", "code": "R", "name": "Resilient Operations", "color": "#14b8a6"},
    "UFP": {"id": "pillar-U-financial", "code": "U", "name": "Unified Financial Protection", "color": "#22c55e"},
    "SDP": {"id": "pillar-S-platforms", "code": "S", "name": "Secure Digital Platforms", "color": "#eab308"},
    "TE": {"id": "pillar-T-ecosystem", "code": "T2", "name": "Trusted Ecosystem", "color": "#a855f7"},
}

# A planilha não tem coluna de "serviço Dock Trust recomendado" — isso é uma
# decisão comercial, não uma classificação técnica que exista na fonte.
# Aplicamos aqui um DEFAULT por pilar (grosseiro, mas mantém o motor de
# recomendações funcionando); refine por controle específico depois via
# ConfigView ou editando este mapeamento e regerando.
PILLAR_CODE_TO_DEFAULT_SERVICE = {
    "TG": "executive-trust-advisory",
    "RO": "cyber-operational-resilience",
    "UFP": "financial-protection",
    "SDP": "cyber-operational-resilience",
    "TE": "executive-trust-advisory",
}

MATURITY_SCORES = {
    "Inexistente": 0,
    "Inicial": 25,
    "Definido": 50,
    "Gerenciado": 75,
    "Otimizado": 100,
}


def slugify_control(area_name: str) -> str:
    import unicodedata
    normalized = unicodedata.normalize("NFKD", area_name).encode("ascii", "ignore").decode()
    return "ctrl-" + normalized.lower().replace(" ", "-").replace("/", "-").replace(",", "")


def build_question(row) -> dict:
    q = {
        "id": row["ID"].lower(),
        "text": row["Pergunta"],
        "weight": 1,
        "options": [
            {"id": "o-inexistente", "label": row["Inexistente"], "score": MATURITY_SCORES["Inexistente"]},
            {"id": "o-inicial", "label": row["Inicial"], "score": MATURITY_SCORES["Inicial"]},
            {"id": "o-definido", "label": row["Definido"], "score": MATURITY_SCORES["Definido"]},
            {"id": "o-gerenciado", "label": row["Gerenciado"], "score": MATURITY_SCORES["Gerenciado"]},
            {"id": "o-otimizado", "label": row["Otimizado"], "score": MATURITY_SCORES["Otimizado"]},
        ],
        "applicability": row["Aplicabilidade"].upper()[:1] == "U" and "UNIVERSAL"
        or (row["Aplicabilidade"] == "Segmentada" and "SEGMENTED")
        or "CONDITIONAL",
    }

    if row["Aplicabilidade"] == "Segmentada":
        q["applicableSegments"] = [p.strip() for p in row["Perfis aplicáveis"].split(",")]
    elif row["Aplicabilidade"] == "Condicional":
        condition_text = row["Condição de aplicação"].strip()
        if condition_text not in CONDITION_TEXT_TO_KEY:
            raise ValueError(
                f"Condição não mapeada em CONDITION_TEXT_TO_KEY para {row['ID']}: {condition_text!r}\n"
                "Adicione essa condição ao dicionário no topo do script antes de gerar."
            )
        q["conditionKey"] = CONDITION_TEXT_TO_KEY[condition_text]
        q["conditionDescription"] = condition_text

    return q


def convert(xlsx_path: str, out_dir: str):
    df = pd.read_excel(xlsx_path, sheet_name="Perguntas")

    pillars = []
    for tower_code, tower_df in df.groupby("Código da torre", sort=False):
        meta = PILLAR_CODE_TO_META[tower_code]
        controls = []
        for area_name, area_df in tower_df.groupby("Área / disciplina", sort=False):
            controls.append({
                "id": slugify_control(area_name),
                "name": area_name,
                "weight": 1,
                "recommendedServiceId": PILLAR_CODE_TO_DEFAULT_SERVICE[tower_code],
                "questions": [build_question(row) for _, row in area_df.iterrows()],
            })
        pillars.append({**meta, "weight": 0.2, "controls": controls})

    # Reordena pillars na ordem canônica T1, R, U, S, T2 (a planilha já vem
    # nessa ordem, mas fixamos explicitamente para não depender disso)
    order = ["T1", "R", "U", "S", "T2"]
    pillars.sort(key=lambda p: order.index(p["code"]))

    framework = {"id": "framework-dock-trust-v3", "pillars": pillars}

    # Segmentos (aba "Perfis e Regras")
    profiles_df = pd.read_excel(xlsx_path, sheet_name="Perfis e Regras", header=None)
    segments = []
    reading_segments = False
    for _, row in profiles_df.iterrows():
        vals = row.tolist()
        if vals[0] == "Código" and vals[1] == "Perfil":
            reading_segments = True
            continue
        if reading_segments:
            if pd.isna(vals[0]):
                break
            segments.append({"code": vals[0], "name": vals[1], "description": vals[2]})

    # Condições (deriva do dicionário de mapeamento, na ordem de 1ª aparição no xlsx)
    seen = set()
    conditions = []
    for _, row in df[df["Aplicabilidade"] == "Condicional"].iterrows():
        text = row["Condição de aplicação"].strip()
        key = CONDITION_TEXT_TO_KEY[text]
        if key not in seen:
            seen.add(key)
            conditions.append({"key": key, "description": text})

    total_questions = sum(len(c["questions"]) for p in pillars for c in p["controls"])

    with open(f"{out_dir}/frameworkV3.json", "w", encoding="utf-8") as f:
        json.dump(framework, f, ensure_ascii=False, indent=2)
    with open(f"{out_dir}/segmentsV3.json", "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    with open(f"{out_dir}/conditionsV3.json", "w", encoding="utf-8") as f:
        json.dump(conditions, f, ensure_ascii=False, indent=2)

    print(f"OK — {total_questions} perguntas, {len(pillars)} pilares, {len(segments)} segmentos, {len(conditions)} condições.")
    for p in pillars:
        n = sum(len(c["questions"]) for c in p["controls"])
        print(f"  {p['code']:3s} {p['name']:35s} {n:3d} perguntas em {len(p['controls'])} controles")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python3 xlsx_to_framework.py <xlsx> <output_dir>")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
