"""Versioned writing skills and composable genre packs for NovelFlow agents."""

from __future__ import annotations

from typing import Any

SKILL_SCHEMA_VERSION = "2.0.0"
AGENT_SKILL_VERSION = "1.1.0"
PACK_SKILL_VERSION = "1.0.0"


CORE_AGENT_SKILLS = [
    {"id": "architect", "label": "作品总编", "instruction": "确认本章是否服务于全书主线、分卷目标和目标读者；优先指出偏题或失衡风险。"},
    {"id": "arc", "label": "剧情弧设计师", "instruction": "核对本章在中层剧情弧中的位置，确保阶段目标、中点转折、高潮和回收按因果推进，避免长篇只剩逐章事件。"},
    {"id": "world", "label": "世界观校验", "instruction": "核对世界规则、力量或社会机制、时间线和代价；禁止为方便剧情临时改写规则。"},
    {"id": "plot", "label": "剧情策划", "instruction": "设计可执行的场景推进、信息释放、升级与反转，让章节目标、冲突和钩子形成完整因果。"},
    {"id": "character", "label": "人物导演", "instruction": "检查人物动机、关系边界、情绪变化和对白习惯，人物必须因自身目标做选择。"},
    {"id": "foreshadow", "label": "伏笔编辑", "instruction": "检查可埋设、推进和回收的线索，控制信息揭示速度，避免提前揭底或遗漏既有伏笔。"},
    {"id": "director", "label": "章节导演", "instruction": "把设定落实为本章目标、场景顺序、核心冲突、情绪落点和章末钩子，禁止泛泛而谈。"},
    {"id": "writer", "label": "正文写手", "instruction": "严格执行前序交接，写出连贯的中文小说正文；遵守视角、字数、人物和世界规则，只推进已确认的事实。"},
    {"id": "review", "label": "终审编辑", "instruction": "审查正文的逻辑、人物、节奏、重复表达和钩子强度，给出可执行修改项与可写入记忆的结论。"},
    {"id": "reviser", "label": "修订写手", "instruction": "依据终审意见逐项修订正文，保留有效情节与作者风格，输出完整可应用正文；不得只给意见或摘要。"},
    {"id": "librarian", "label": "资料管理员", "instruction": "从最终正文提取人物状态、时间地点、物品、组织、能力、剧情弧和伏笔变化，形成可核对、可引用的结构化交接。"},
]

CREATIVE_LAYERS = {
    "themePacks": {
        "label": "主题材",
        "multiple": False,
        "options": [
            ("xuanhuan", "玄幻升级", "等级、资源、宗门与成长必须有清晰代价和阶段目标。"),
            ("xianxia", "仙侠修真", "修行、因果、道心与势力博弈遵循既定规则。"),
            ("western_fantasy", "西方奇幻", "种族、魔法和冒险队伍的规则需前后一致。"),
            ("urban", "都市现实", "职业、社会关系和现实成本必须可信。"),
            ("urban_power", "都市异能", "超常能力需要边界、代价和现实社会反馈。"),
            ("business", "商战职场", "竞争、谈判、职业流程与利益链应合乎现实逻辑。"),
            ("history", "历史正剧", "时代制度、称谓和事件因果必须自洽。"),
            ("power", "架空权谋", "信息、立场和权力交换必须层层递进。"),
            ("scifi", "科幻", "技术设定必须有约束，因果与社会影响要连续。"),
            ("apocalypse", "末世生存", "资源、生存压力和群体秩序应持续产生选择。"),
            ("game", "游戏电竞", "规则、赛制、成长和竞技反馈必须可追踪。"),
            ("mystery", "悬疑推理", "线索、误导和真相必须可回溯验证。"),
            ("horror", "惊悚恐怖", "恐惧来自可感知的威胁和逐步升级的规则。"),
            ("ancient_romance", "古言情感", "礼法、身份和情感选择共同推动关系变化。"),
            ("modern_romance", "现言情感", "关系推进建立在具体事件、边界和选择上。"),
            ("campus", "校园青春", "成长、友情和情感变化贴合年龄与校园环境。"),
            ("wealth", "豪门婚恋", "利益、家庭和情感冲突都要有真实筹码。"),
            ("farming", "种田经营", "资源积累、生产流程和社区关系应循序渐进。"),
            ("entertainment", "娱乐圈", "行业流程、舆论和作品反馈需要符合现实节奏。"),
            ("infinite", "无限流副本", "每个副本有明确规则、目标、代价和阶段回收。"),
            ("ensemble", "群像冒险", "每位关键角色都有独立目标与影响主线的时刻。"),
        ],
    },
    "audiencePacks": {
        "label": "受众与情感",
        "multiple": False,
        "options": [
            ("male_upgrade", "男频升级", "升级、对抗和阶段回报要清晰，主角主动解决问题。"),
            ("female_emotion", "女频情感", "情感关系要渐进、平等有张力，避免无理由误会拖延。"),
            ("sweet", "甜宠治愈", "情绪回报稳定，冲突服务于关系深化。"),
            ("intense", "虐恋拉扯", "痛点来自立场和选择，不能依赖降智误会。"),
            ("dual_power", "双强对抗", "双方都具备能力和目标，关系随博弈变化。"),
            ("no_cp", "无 CP 成长", "核心满足来自成长、事业、冒险或群像关系。"),
        ],
    },
    "mechanicPacks": {
        "label": "世界机制",
        "multiple": True,
        "options": [
            ("system", "系统", "任务、奖励、限制与失败代价必须明确。"),
            ("rebirth", "重生", "前世信息只能在合理节点发挥作用，并带来新变量。"),
            ("transmigration", "穿越", "现代知识或异界身份必须受环境与规则限制。"),
            ("dungeon", "副本", "每次挑战都有规则、风险、产出和后续影响。"),
            ("livestream", "直播", "观众反馈、平台规则和舆论影响需要真实可见。"),
            ("cultivation", "修炼体系", "境界、功法、资源和战力差必须可追踪。"),
            ("detective", "探案", "证据链、嫌疑人动机和推理过程要能回溯。"),
            ("business_growth", "经营建设", "资源、成本、增长和人际网络按阶段积累。"),
        ],
    },
    "stylePacks": {
        "label": "写法节奏",
        "multiple": True,
        "options": [
            ("fast", "爽文快节奏", "每章尽快出现推进、选择或回报，章末保留动力。"),
            ("slow", "慢热沉浸", "允许铺垫，但每个场景必须增加关系、信息或氛围。"),
            ("hook", "强钩子", "章节结尾优先留下未解决的选择、危机或信息差。"),
            ("logic", "硬核逻辑", "因果、规则和信息来源必须可解释。"),
            ("comedy", "轻喜剧", "幽默服务于人物性格和情节，不破坏情绪重量。"),
            ("cinematic", "电影感", "以可感知动作、场景和镜头化细节承载情绪。"),
            ("first_person", "强代入", "紧贴主角感知，避免全知叙述泄露信息。"),
        ],
    },
}


def public_creative_options() -> dict[str, Any]:
    return {
        key: {
            "label": layer["label"],
            "multiple": layer["multiple"],
            "version": PACK_SKILL_VERSION,
            "options": [{"id": item_id, "label": label, "version": PACK_SKILL_VERSION} for item_id, label, _ in layer["options"]],
        }
        for key, layer in CREATIVE_LAYERS.items()
    }


def public_agent_skills() -> list[dict[str, str]]:
    return [{"id": skill["id"], "label": skill["label"], "version": AGENT_SKILL_VERSION} for skill in CORE_AGENT_SKILLS]


def creative_profile(settings: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    profile: dict[str, list[dict[str, str]]] = {}
    aliases = {"themePacks": "themePack", "audiencePacks": "audiencePack", "mechanicPacks": "mechanicPack"}
    for key, layer in CREATIVE_LAYERS.items():
        allowed = {item_id: (label, instruction) for item_id, label, instruction in layer["options"]}
        value = settings.get(key, settings.get(aliases.get(key, ""), [] if layer["multiple"] else ""))
        raw = value if layer["multiple"] else [value]
        if not isinstance(raw, list):
            raw = []
        selected = []
        for item_id in raw[:3]:
            if item_id in allowed:
                label, instruction = allowed[item_id]
                selected.append({"id": item_id, "label": label, "instruction": instruction})
        profile[key] = selected
    return profile


def selected_skill_text(settings: dict[str, Any]) -> str:
    profile = creative_profile(settings)
    sections = []
    for key, values in profile.items():
        if values:
            label = CREATIVE_LAYERS[key]["label"]
            sections.append(f"{label}：" + "；".join(f"{item['label']}（{item['instruction']}）" for item in values))
    length_rules = {
        "short": "短篇模式：聚焦一个核心事件，优先完成冲突、转折与结尾，不扩展无关支线。",
        "medium": "中篇模式：保持完整人物弧光和阶段转折，伏笔数量受控并在主线内回收。",
        "long": "长篇模式：按分卷推进，持续维护人物状态、伏笔生命周期与长期因果，避免章节重复推进。",
    }
    length_mode = str(settings.get("lengthMode", ""))
    if length_mode in length_rules:
        sections.append(length_rules[length_mode])
    return "\n".join(sections) or "未选择额外题材包，遵守作品档案与章节规划。"


def agent_skill(agent_id: str) -> dict[str, str]:
    skill = next((item for item in CORE_AGENT_SKILLS if item["id"] == agent_id), CORE_AGENT_SKILLS[0])
    return {**skill, "version": AGENT_SKILL_VERSION, "schemaVersion": SKILL_SCHEMA_VERSION}
