
import React, { useState, useEffect, useRef } from 'react';
import {
    BookOpen, Users, Globe, GitMerge, List, Activity, PenTool,
    Settings, RefreshCw, Sparkles, Copy, FileText, Play, Gavel,
    Clock, Archive, LayoutDashboard, LayoutList
} from 'lucide-react';
import unclecatlogo from './public/unclecatlogo.png'; // 导入图片作为模块
import {
    ApiConfig, Chapter, GeneratedData, UserInputs, StepDefinition, StateArchive
} from './types';
import { PROMPTS, TAGS, STORY_TONES, ENDING_TYPES, NARRATIVE_PERSPECTIVES, THEME_MATCH_PROMPT, PLOT_STRUCTURES } from './constants';
import { generateContent, formatPrompt } from './services/apiService';
import StepCard from './components/StepCard';
import MarkdownViewer from './components/MarkdownViewer';
import WritingStep from './components/WritingStep';
import {
    PromptEditorModal, CustomRequestModal, JudgeResultModal, ConfigModal, PromptManagerModal, PlotStructureModal
} from './components/Modals';
import { useAlert } from './components/CustomAlert';

// 定义环境变量类型，用于控制是否显示提示词管理功能
declare const __HIDE_PROMPT_MANAGEMENT__: boolean;

const STEPS: StepDefinition[] = [
    { id: 'init', title: '创作初始化', icon: BookOpen },
    { id: 'dna', title: '核心DNA', icon: Activity, promptKey: 'DNA' },
    { id: 'characters', title: '角色动力学', icon: Users, promptKey: 'CHARACTERS' },
    { id: 'world', title: '世界观', icon: Globe, promptKey: 'WORLD' },
    { id: 'plot', title: '情节架构', icon: GitMerge, promptKey: 'PLOT' },
    { id: 'blueprint', title: '章节蓝图', icon: List, promptKey: 'BLUEPRINT' },
    { id: 'state', title: '角色状态库', icon: Activity, promptKey: 'STATE_INIT' },
    { id: 'writing', title: '正文创作', icon: PenTool, promptKey: 'CHAPTER_1' }
];

export default function App() {
    const { showAlert, showConfirm } = useAlert();
    const [currentStep, setCurrentStep] = useState(0);
    const [inputs, setInputs] = useState<UserInputs>({
        topic: '',
        genre: '',
        tone: '',
        ending: '',
        perspective: '',
        numberOfChapters: 12,
        wordCount: 2000,
        customRequirements: '',
        novelTitle: ''
    });

    const [apiConfig, setApiConfig] = useState<ApiConfig>({
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: '',
        textModel: 'gemini-2.5-flash'
    });

    const [generatedData, setGeneratedData] = useState<GeneratedData>({
        dna: null,
        globalSummary: null,
        characters: null,
        world: null,
        plot: null,
        blueprint: null,
        state: null,
        chapters: [],
        stateHistory: []
    });

    const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});

    const [isGenerating, setIsGenerating] = useState(false);
    const [isJudging, setIsJudging] = useState(false);
    const [isSyncingContext, setIsSyncingContext] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showPromptManager, setShowPromptManager] = useState(false);

    const [showPromptModal, setShowPromptModal] = useState(false);
    const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
    const [fullPrompt, setFullPrompt] = useState<string>("");
    const [isFullPromptView, setIsFullPromptView] = useState<boolean>(false);

    // 存储各步骤的自定义修改要求
    const [stepCustomInstructions, setStepCustomInstructions] = useState<Record<string, string>>({});

    const [showCustomRequestModal, setShowCustomRequestModal] = useState(false);
    const [customModalTitle, setCustomModalTitle] = useState("");

    // 控制移动端侧边栏显示/隐藏
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // 使用ref保存回调函数，确保同步更新
    const customPromptCallbackRef = useRef<(val: string) => void>(() => { });
    // 保存当前模态框对应的步骤标题
    const currentModalTitleRef = useRef<string>("");

    const [judgeResult, setJudgeResult] = useState("");
    const [showJudgeModal, setShowJudgeModal] = useState(false);

    const [viewArchiveChapter, setViewArchiveChapter] = useState<number>(0);
    const [isInitCompleted, setIsInitCompleted] = useState<boolean>(false);
    // 用于跟踪正文创作步骤的状态，包括当前查看的章节、选中的题材等
    const [writingStepState, setWritingStepState] = useState<any>({
        viewChapter: 1,
        selectedTheme: null
    });

    // 文件输入元素引用，用于导入功能
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 导入项目功能
    const handleImport = () => {
        // 创建或获取文件输入元素
        if (!fileInputRef.current) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = handleFileSelect;
            input.style.display = 'none';
            document.body.appendChild(input);
            fileInputRef.current = input;
        }
        // 触发文件选择
        fileInputRef.current.click();
    };

    // 处理文件选择事件
    const handleFileSelect = (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                // 解析JSON数据
                const content = e.target?.result as string;
                const projectData = JSON.parse(content);

                // 验证数据结构
                if (!projectData.inputs || !projectData.generatedData) {
                    throw new Error('无效的项目文件格式！');
                }

                // 更新所有相关状态
                setInputs(projectData.inputs);
                setGeneratedData(projectData.generatedData);
                setStepCustomInstructions(projectData.stepCustomInstructions || {});
                // 如果有小说名称，设置isInitCompleted为true
                if (projectData.inputs.novelTitle) {
                    setIsInitCompleted(true);
                }

                // 提示导入成功
                showAlert('项目导入成功！', 'success');

                // 重置文件输入
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('导入项目失败:', error);
                showAlert('项目导入失败，请检查文件格式！', 'error');
            }
        };

        reader.onerror = () => {
            showAlert('文件读取失败，请重试！', 'error');
        };

        reader.readAsText(file);
    };

    // 重置项目功能
    const handleReset = async () => {
        // 确认是否重置项目
        const confirmed = await showConfirm('确定要清空/重置当前项目吗？此操作不可恢复！', 'warning');
        if (!confirmed) return;

        try {
            // 重置所有相关状态
            setInputs({
                topic: '',
                genre: '',
                tone: '',
                ending: '',
                perspective: '',
                numberOfChapters: 12,
                wordCount: 2000,
                customRequirements: '',
                novelTitle: ''
            });
            setGeneratedData({
                dna: null,
                globalSummary: null,
                characters: null,
                world: null,
                plot: null,
                blueprint: null,
                state: null,
                chapters: [],
                stateHistory: []
            });
            setStepCustomInstructions({});
            setIsInitCompleted(false);
            setWritingStepState({
                viewChapter: 1,
                selectedTheme: null
            });
            setCurrentStep(0);

            // 提示重置成功
            showAlert('项目已成功重置！', 'success');
        } catch (error) {
            console.error('重置项目失败:', error);
            showAlert('项目重置失败，请重试！', 'error');
        }
    };

    // 剧情结构选择相关状态
    const [showPlotStructureModal, setShowPlotStructureModal] = useState(false);
    const [selectedPlotStructure, setSelectedPlotStructure] = useState<string>(PLOT_STRUCTURES[0]?.name || "三幕式结构（Three-Act Structure）");

    useEffect(() => {
        // 添加try-catch块，确保localStorage无法访问时应用仍能正常运行
        try {
            const savedConfig = localStorage.getItem('deepstory_config');
            if (savedConfig) {
                try {
                    const parsedConfig = JSON.parse(savedConfig);
                    // 确保有provider字段，兼容旧版本配置
                    setApiConfig({
                        provider: parsedConfig.provider || 'google',
                        ...parsedConfig
                    });
                } catch (e) {
                    console.error("Config load error", e);
                }
            }
        } catch (e) {
            // 处理localStorage无法访问的情况（如隐私模式）
            console.error("localStorage access error", e);
        }
    }, []);

    // 保存配置时添加try-catch块，确保localStorage无法访问时应用仍能正常运行
    const handleConfigSave = (config: ApiConfig) => {
        setApiConfig(config);
        try {
            localStorage.setItem('deepstory_config', JSON.stringify(config));
        } catch (e) {
            console.error("localStorage save error", e);
        }
    };

    // 查找最合适的状态存档
    const findLatestStateArchive = (targetChapterNum: number) => {
        // 对于第1章，直接使用初始状态
        if (targetChapterNum === 1) {
            return {
                characterState: generatedData.state || "暂无角色状态",
                globalSummary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
                chapterSummary: "暂无章节摘要"
            };
        }

        // 对于后续章节，查找最大的章节号 ≤ targetChapterNum - 1 的存档
        const sortedArchives = [...(generatedData.stateHistory || [])].sort((a, b) => b.chapterNum - a.chapterNum);

        // 查找第一个章节号小于 targetChapterNum 的存档
        const latestArchive = sortedArchives.find(archive => archive.chapterNum < targetChapterNum);

        // 如果找到存档，使用存档中的状态；否则使用当前全局状态
        if (latestArchive) {
            return {
                characterState: latestArchive.characterState,
                globalSummary: latestArchive.globalSummary,
                chapterSummary: latestArchive.chapterSummary
            };
        }

        // 没有找到存档，使用当前全局状态
        return {
            characterState: generatedData.state || "暂无角色状态",
            globalSummary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
            chapterSummary: "暂无章节摘要"
        };
    };

    // 导出项目功能
    const handleExport = () => {
        try {
            // 创建包含所有项目数据的对象
            const projectData = {
                version: "1.0.0", // 导出版本号
                inputs,
                generatedData,
                stepCustomInstructions,
                exportDate: new Date().toISOString()
            };

            // 转换为JSON字符串，格式化输出
            const jsonString = JSON.stringify(projectData, null, 2);

            // 创建Blob对象
            const blob = new Blob([jsonString], { type: "application/json" });

            // 生成下载链接
            const url = URL.createObjectURL(blob);

            // 创建下载链接元素
            const a = document.createElement("a");
            a.href = url;
            // 使用小说名称或默认名称作为文件名
            a.download = `${inputs.novelTitle || "deepstory-project"}.json`;

            // 触发下载
            document.body.appendChild(a);
            a.click();

            // 清理
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // 提示导出成功
            showAlert("项目导出成功！", "success");
        } catch (error) {
            console.error("导出项目失败:", error);
            showAlert("项目导出失败，请重试！", "error");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const cleanCodeBlock = (text: string) => {
        if (!text || typeof text !== 'string') return "";

        let clean = text
            // 移除开头的代码块标记（支持带语言和不带语言的格式）
            .replace(/^```[a-z]*\s*/i, '')
            // 移除结尾的代码块标记
            .replace(/\s*```$/, '')
            // 移除任何格式的代码块标记（包括中间的）
            .replace(/```[a-z]*\s*/gi, '')
            // 移除多余的空白行
            .replace(/\n\s*\n/g, '\n\n')
            // 移除首尾空白
            .trim();

        return clean;
    };

    // 解析AI生成的基础设定和核心DNA
    const parseGeneratedResult = (result: string) => {
        const cleanedResult = cleanCodeBlock(result);

        // 提取基础设定部分 - 精确匹配，只到下一个标题前或结束
        const basicSettingsRegex = /(?:^|\n)(?:##\s*)?基础设定\s*\(BASIC_SETTINGS\)[\s\S]*?(?=(?:\n|^)(?:##\s*)?(?!基础设定|核心DNA))/i;
        const basicSettingsMatch = cleanedResult.match(basicSettingsRegex);
        const basicSettingsText = basicSettingsMatch ? basicSettingsMatch[0] : "";

        // 提取核心DNA部分 - 精确匹配，只到下一个标题前或结束
        const coreDNARegex = /(?:^|\n)(?:##\s*)?核心DNA\s*\(STORY_DNA\)[\s\S]*?(?=(?:\n|^)(?:##\s*)?(?!基础设定|核心DNA))/i;
        const coreDNAMatch = cleanedResult.match(coreDNARegex);
        const coreDNAText = coreDNAMatch ? coreDNAMatch[0] : "";

        // 解析基础设定键值对
        const settings: Partial<UserInputs> = {};

        // 小说名称
        const novelTitleMatch = basicSettingsText.match(/小说名称：([^\n]+)/);
        if (novelTitleMatch) {
            settings.novelTitle = novelTitleMatch[1].trim();
        }

        // 故事基调
        const toneMatch = basicSettingsText.match(/故事基调：([^\n]+)/);
        if (toneMatch) {
            settings.tone = toneMatch[1].trim();
        }

        // 结局倾向
        const endingMatch = basicSettingsText.match(/结局倾向：([^\n]+)/);
        if (endingMatch) {
            settings.ending = endingMatch[1].trim();
        }

        // 叙事视角
        const perspectiveMatch = basicSettingsText.match(/叙事视角：([^\n]+)/);
        if (perspectiveMatch) {
            settings.perspective = perspectiveMatch[1].trim();
        }

        // 预计章节数
        const chaptersMatch = basicSettingsText.match(/预计章节数：(\d+)章/);
        if (chaptersMatch) {
            settings.numberOfChapters = parseInt(chaptersMatch[1], 10);
        }

        // 每章字数
        const wordCountMatch = basicSettingsText.match(/每章字数：(\d+)字/);
        if (wordCountMatch) {
            settings.wordCount = parseInt(wordCountMatch[1], 10);
        }

        // 自定义特殊要求
        const customReqMatch = basicSettingsText.match(/自定义特殊要求：([^\n]+)/);
        if (customReqMatch) {
            settings.customRequirements = customReqMatch[1].trim();
        }

        return { basicSettings: settings, coreDNA: coreDNAText };
    };

    const handleJudge = async () => {
        if (!inputs.topic || !inputs.genre) {
            showAlert("请先填写主题和题材", "warning");
            return;
        }
        setLoadingMessage("判官正在审阅您的选题...");
        setIsJudging(true);
        try {
            // 构建包含完整基础设定的用户提示词
            let userPrompt = `题材：${inputs.genre}\n核心脑洞：${inputs.topic}\n`;
            userPrompt += `小说名称：${inputs.novelTitle || "未命名"}\n`;
            userPrompt += `故事基调：${inputs.tone || "未指定"}\n`;
            userPrompt += `结局倾向：${inputs.ending || "未指定"}\n`;
            userPrompt += `叙事视角：${inputs.perspective || "未指定"}\n`;
            userPrompt += `预计章节数：${inputs.numberOfChapters || 10}章\n`;
            userPrompt += `每章字数：${inputs.wordCount || 2000}字\n`;
            userPrompt += `自定义特殊要求：${inputs.customRequirements || "无"}\n`;

            if (generatedData.dna) {
                userPrompt += `\n当前核心DNA：\n${generatedData.dna}`;
            }
            const template = customPrompts['JUDGE'] || PROMPTS.JUDGE;
            const result = await generateContent(template, userPrompt, apiConfig);
            setJudgeResult(result);
            setShowJudgeModal(true);
        } catch (e: any) {
            showAlert("判官请假了：" + e.message, "error");
        } finally {
            setIsJudging(false);
        }
    };

    const handleSelectJudgeProposal = async (proposalIndex: number) => {
        if (!judgeResult) return;

        setLoadingMessage(`正在根据方案${proposalIndex}重写核心DNA...`);
        setIsGenerating(true);
        try {
            // 从完整评审结果中提取用户选择的具体方案
            const extractSelectedProposal = (result: string, index: number) => {
                // 方案匹配正则，提取指定索引的方案
                const targetIndex = index; // 已经是1-based索引，无需转换

                // 提取完整的方案内容（包括方案内的所有方向）
                const proposalRegex = new RegExp(`【方案${targetIndex}：.*?】[\s\S]*?(?=【方案${targetIndex + 1}：|$)`, 'i');
                const proposalMatch = result.match(proposalRegex);

                // 如果找到匹配的方案，返回该方案的完整内容
                // 注意：每个方案内部的方向编号都是从1开始的，不是从方案索引开始的
                return proposalMatch ? proposalMatch[0] : result;
            };

            // 提取用户选择的具体方案
            const selectedProposal = extractSelectedProposal(judgeResult, proposalIndex);

            // 使用PROMPTS.DNA模板生成DNA
            const template = customPrompts['DNA'] || PROMPTS.DNA;

            // 构建完整变量，包含所有基础设定
            const variables = {
                novel_title: String(inputs.novelTitle || "未命名"),
                topic: String(inputs.topic || ""),
                genre: String(inputs.genre || ""),
                tone: String(inputs.tone || "未指定"),
                ending: String(inputs.ending || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                number_of_chapters: String(inputs.numberOfChapters || 10),
                word_count: String(inputs.wordCount || 2000),
                custom_requirements: String(inputs.customRequirements || "无"),
                custom_instruction: `严格根据判官评审方案${proposalIndex}重写核心DNA，只生成该方案的内容，不要生成其他方案或方向：${selectedProposal}`,
                user_guidance: String(inputs.customRequirements || "无")
            };

            // 使用formatPrompt函数处理所有变量替换
            const prompt = formatPrompt(template, variables);

            // 生成新的DNA
            const newContent = await generateContent(prompt, "开始生成任务", apiConfig);

            // 清理生成结果，只保留基础设定和核心DNA部分
            const cleanGeneratedResult = (result: string) => {
                // 1. 先清理代码块格式和多余内容
                let cleaned = result
                    // 移除代码块格式
                    .replace(/^```[a-z]*\s*/i, '')
                    .replace(/\s*```$/g, '')
                    // 移除开头的多余标题（如"修仙拾荒日常 - 完整故事架构"）
                    .replace(/^.*?(?=基础设定)/si, '')
                    // 移除DNA解析说明及后面的所有内容
                    .replace(/DNA解析说明[\s\S]*$/i, '')
                    // 移除所有非基础设定和非核心DNA的标题
                    .replace(/(?:^|\n)##\s*(?!基础设定|核心DNA)[^\n]*/gi, '')
                    .trim();

                // 2. 提取基础设定部分 - 改进正则，只匹配真正的基础设定内容
                // 基础设定应该是标题+列表项的形式，所以匹配到基础设定标题开始，直到遇到第一个非列表项且不是空行的内容
                const basicSettingsRegex = /(?:^|\n)(##\s*)?基础设定\s*\(BASIC_SETTINGS\)(?:\n|$)([\s\S]*?)(?=(?:^|\n)(?!(?:\s*\*|\s*-|\s*\n|$))|$)/i;
                const basicSettingsMatch = cleaned.match(basicSettingsRegex);
                let basicSettings = basicSettingsMatch ? `${basicSettingsMatch[1] || '## '}基础设定 (BASIC_SETTINGS)\n${basicSettingsMatch[2]}`.trim() : '';

                // 3. 提取核心DNA部分
                let coreDNA = '';

                // 先尝试匹配包含核心DNA标题的内容
                const coreDNARegex = /(?:^|\n)(##\s*)?核心DNA\s*\(STORY_DNA\)[\s\S]*/i;
                const coreDNAMatch = cleaned.match(coreDNARegex);

                if (coreDNAMatch) {
                    // 如果匹配到，直接使用
                    coreDNA = coreDNAMatch[0].trim();
                } else {
                    // 如果没有匹配到核心DNA标题，尝试从基础设定之后提取核心DNA内容
                    if (basicSettings) {
                        // 提取基础设定结束后的内容作为核心DNA
                        const basicSettingsEnd = cleaned.indexOf(basicSettings) + basicSettings.length;
                        const remainingContent = cleaned.slice(basicSettingsEnd).trim();

                        if (remainingContent) {
                            // 如果有剩余内容，将其作为核心DNA，并添加标题
                            coreDNA = `## 核心DNA (STORY_DNA)\n${remainingContent}`;
                        }
                    } else {
                        // 如果没有基础设定，检查是否整个内容都是核心DNA
                        if (cleaned && !cleaned.includes('基础设定')) {
                            coreDNA = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                        }
                    }
                }

                // 4. 特殊处理：如果基础设定包含了核心DNA内容（因为正则匹配问题），手动分离
                if (basicSettings && !coreDNA) {
                    // 检查基础设定中是否包含核心DNA的内容结构
                    const lines = basicSettings.split('\n');
                    let basicSettingsLines: string[] = [];
                    let coreDNALines: string[] = [];
                    let isInCoreDNA = false;

                    for (const line of lines) {
                        if (basicSettingsLines.length > 0 && !line.trim().startsWith('*') && !line.trim().startsWith('-') && line.trim()) {
                            // 遇到非列表项且非空行，开始核心DNA部分
                            isInCoreDNA = true;
                            coreDNALines.push(line);
                        } else if (isInCoreDNA) {
                            coreDNALines.push(line);
                        } else {
                            basicSettingsLines.push(line);
                        }
                    }

                    // 更新基础设定和核心DNA
                    basicSettings = basicSettingsLines.join('\n').trim();
                    const coreDNAContent = coreDNALines.join('\n').trim();

                    if (coreDNAContent) {
                        coreDNA = `## 核心DNA (STORY_DNA)\n${coreDNAContent}`;
                    }
                }

                // 5. 组合两部分内容
                let finalContent = '';
                if (basicSettings && coreDNA) {
                    finalContent = `${basicSettings}\n\n${coreDNA}`;
                } else if (basicSettings) {
                    finalContent = basicSettings;
                } else if (coreDNA) {
                    finalContent = coreDNA;
                } else {
                    // 如果都没有，确保至少返回一个有标题的内容
                    finalContent = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                }

                // 6. 确保正确的Markdown格式
                finalContent = finalContent
                    // 确保基础设定有##前缀
                    .replace(/(?:^|\n)(?!##)(基础设定\s*\(BASIC_SETTINGS\))/i, '\n## $1')
                    // 确保核心DNA有##前缀
                    .replace(/(?:^|\n)(?!##)(核心DNA\s*\(STORY_DNA\))/i, '\n## $1')
                    // 清理多余空行
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();

                return finalContent;
            };

            // 清理生成结果，去掉前面的说明文字并修复格式
            const cleanedContent = cleanGeneratedResult(newContent);

            // 将清理后的生成结果（只包含核心DNA）保存到generatedData.dna
            setGeneratedData(prev => ({ ...prev, dna: cleanedContent }));

            showAlert(`已采纳方案${proposalIndex}并重写核心DNA`, "success");
        } catch (error: any) {
            console.error('重写失败:', error);
            showAlert('重写失败：' + error.message, "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateStep = async (stepId: keyof GeneratedData, customReq: string = "") => {
        // 添加更全面的API配置检查
        if (!apiConfig.apiKey || !apiConfig.baseUrl || !apiConfig.textModel) {
            setShowConfigModal(true);
            return;
        }

        // 对于custom模型，确保customTextModel已设置
        if (apiConfig.textModel === 'custom' && !apiConfig.customTextModel) {
            setShowConfigModal(true);
            return;
        }

        const stepDef = STEPS.find(s => s.id === stepId);
        if (!stepDef || !stepDef.promptKey) return;

        setLoadingMessage(`AI 正在构建${stepDef.title}...`);
        setIsGenerating(true);
        try {
            const template = customPrompts[stepDef.promptKey] || PROMPTS[stepDef.promptKey as keyof typeof PROMPTS];

            const variables = {
                novel_title: String(inputs.novelTitle || "未命名"),
                topic: String(inputs.topic || ""),
                genre: String(inputs.genre || ""),
                tone: String(inputs.tone || "未指定"),
                ending: String(inputs.ending || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                number_of_chapters: String(inputs.numberOfChapters || 10),
                word_count: String(inputs.wordCount || 2000),
                custom_requirements: String(inputs.customRequirements || "无"),
                custom_instruction: String(customReq || "无"),
                STORY_DNA: String(generatedData.dna || "暂无核心DNA"),
                character_dynamics: String(generatedData.characters || "暂无角色设定"),
                world_building: String(generatedData.world || "暂无世界观设定"),
                plot_architecture: String(generatedData.plot || "暂无情节架构"),
                plot_structure: selectedPlotStructure
            };

            console.log('[Generate Content] Processing variables:', variables);

            // 使用formatPrompt函数处理所有变量替换，确保plot_structure被正确替换
            const prompt = formatPrompt(template, {
                ...variables,
                user_guidance: String(inputs.customRequirements || "无")
            });

            console.log('[Generate Content] Final prompt:', prompt);
            const result = await generateContent(prompt, "开始生成任务", apiConfig);

            // 清理生成结果，只保留基础设定和核心DNA部分（仅用于核心DNA步骤）
            const cleanGeneratedResult = (result: string) => {
                // 1. 先清理代码块格式和多余内容
                let cleaned = result
                    // 移除代码块格式
                    .replace(/^```[a-z]*\s*/i, '')
                    .replace(/\s*```$/g, '')
                    // 移除开头的多余标题（如"修仙拾荒日常 - 完整故事架构"）
                    .replace(/^.*?(?=基础设定)/si, '')
                    // 移除DNA解析说明及后面的所有内容
                    .replace(/DNA解析说明[\s\S]*$/i, '')
                    // 移除所有非基础设定和非核心DNA的标题
                    .replace(/(?:^|\n)##\s*(?!基础设定|核心DNA)[^\n]*/gi, '')
                    .trim();

                // 2. 提取基础设定部分 - 改进正则，只匹配真正的基础设定内容
                // 基础设定应该是标题+列表项的形式，所以匹配到基础设定标题开始，直到遇到第一个非列表项且不是空行的内容
                const basicSettingsRegex = /(?:^|\n)(##\s*)?基础设定\s*\(BASIC_SETTINGS\)(?:\n|$)([\s\S]*?)(?=(?:^|\n)(?!(?:\s*\*|\s*-|\s*\n|$))|$)/i;
                const basicSettingsMatch = cleaned.match(basicSettingsRegex);
                let basicSettings = basicSettingsMatch ? `${basicSettingsMatch[1] || '## '}基础设定 (BASIC_SETTINGS)\n${basicSettingsMatch[2]}`.trim() : '';

                // 3. 提取核心DNA部分
                let coreDNA = '';

                // 先尝试匹配包含核心DNA标题的内容
                const coreDNARegex = /(?:^|\n)(##\s*)?核心DNA\s*\(STORY_DNA\)[\s\S]*/i;
                const coreDNAMatch = cleaned.match(coreDNARegex);

                if (coreDNAMatch) {
                    // 如果匹配到，直接使用
                    coreDNA = coreDNAMatch[0].trim();
                } else {
                    // 如果没有匹配到核心DNA标题，尝试从基础设定之后提取核心DNA内容
                    if (basicSettings) {
                        // 提取基础设定结束后的内容作为核心DNA
                        const basicSettingsEnd = cleaned.indexOf(basicSettings) + basicSettings.length;
                        const remainingContent = cleaned.slice(basicSettingsEnd).trim();

                        if (remainingContent) {
                            // 如果有剩余内容，将其作为核心DNA，并添加标题
                            coreDNA = `## 核心DNA (STORY_DNA)\n${remainingContent}`;
                        }
                    } else {
                        // 如果没有基础设定，检查是否整个内容都是核心DNA
                        if (cleaned && !cleaned.includes('基础设定')) {
                            coreDNA = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                        }
                    }
                }

                // 4. 特殊处理：如果基础设定包含了核心DNA内容（因为正则匹配问题），手动分离
                if (basicSettings && !coreDNA) {
                    // 检查基础设定中是否包含核心DNA的内容结构
                    const lines = basicSettings.split('\n');
                    let basicSettingsLines: string[] = [];
                    let coreDNALines: string[] = [];
                    let isInCoreDNA = false;

                    for (const line of lines) {
                        if (basicSettingsLines.length > 0 && !line.trim().startsWith('*') && !line.trim().startsWith('-') && line.trim()) {
                            // 遇到非列表项且非空行，开始核心DNA部分
                            isInCoreDNA = true;
                            coreDNALines.push(line);
                        } else if (isInCoreDNA) {
                            coreDNALines.push(line);
                        } else {
                            basicSettingsLines.push(line);
                        }
                    }

                    // 更新基础设定和核心DNA
                    basicSettings = basicSettingsLines.join('\n').trim();
                    const coreDNAContent = coreDNALines.join('\n').trim();

                    if (coreDNAContent) {
                        coreDNA = `## 核心DNA (STORY_DNA)\n${coreDNAContent}`;
                    }
                }

                // 5. 组合两部分内容
                let finalContent = '';
                if (basicSettings && coreDNA) {
                    finalContent = `${basicSettings}\n\n${coreDNA}`;
                } else if (basicSettings) {
                    finalContent = basicSettings;
                } else if (coreDNA) {
                    finalContent = coreDNA;
                } else {
                    // 如果都没有，确保至少返回一个有标题的内容
                    finalContent = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                }

                // 6. 确保正确的Markdown格式
                finalContent = finalContent
                    // 确保基础设定有##前缀
                    .replace(/(?:^|\n)(?!##)(基础设定\s*\(BASIC_SETTINGS\))/i, '\n## $1')
                    // 确保核心DNA有##前缀
                    .replace(/(?:^|\n)(?!##)(核心DNA\s*\(STORY_DNA\))/i, '\n## $1')
                    // 清理多余空行
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();

                return finalContent;
            };

            const processedResult = stepId === 'dna' ? cleanGeneratedResult(result) : result;

            setGeneratedData(prev => {
                const newData = {
                    ...prev,
                    [stepId]: processedResult
                };

                if (stepId === 'state') {
                    const initialArchive: StateArchive = {
                        chapterNum: 0,
                        title: "初始设定",
                        globalSummary: prev.dna || "暂无",
                        characterState: processedResult,
                        chapterSummary: "无 (初始状态)",
                        timestamp: Date.now()
                    };
                    newData.stateHistory = [initialArchive];
                    setViewArchiveChapter(0);
                }

                return newData;
            });
        } catch (error: any) {
            console.error("Generation failed:", error);

            // 增强错误信息，特别是针对角色动力学步骤
            let errorMessage = error.message;
            let additionalTips = "";

            if (stepId === 'characters') {
                if (errorMessage.includes('超时')) {
                    additionalTips = "\n建议：1. 尝试使用更快的模型（如Gemini 2.5 Flash）；2. 检查网络连接；3. 减少自定义要求的复杂度；4. 尝试减少生成的角色数量。";
                }
                errorMessage = `角色动力学生成失败: ${error.message}${additionalTips}`;
            } else {
                errorMessage = `生成失败: ${error.message}`;
            }

            showAlert(errorMessage, "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateChapter = async (chapterNum: number, params: any, theme: any) => {
        // 添加更全面的API配置检查
        if (!apiConfig.apiKey || !apiConfig.baseUrl || !apiConfig.textModel) {
            setShowConfigModal(true);
            return;
        }

        // 对于custom模型，确保customTextModel已设置
        if (apiConfig.textModel === 'custom' && !apiConfig.customTextModel) {
            setShowConfigModal(true);
            return;
        }
        setLoadingMessage(`AI 正在撰写 ${params.title || `第${chapterNum}章`}...`);
        setIsGenerating(true);

        try {
            const isFirstChapter = chapterNum === 1;
            const promptKey = isFirstChapter ? 'CHAPTER_1' : 'CHAPTER_NEXT';
            const template = customPrompts[promptKey] || PROMPTS[promptKey];

            let previousContent = "";
            if (!isFirstChapter) {
                const prevChap = generatedData.chapters[chapterNum - 2];
                previousContent = prevChap ? prevChap.content.slice(-800) : "无前文";
            }

            // 从章节蓝图中获取下章信息
            let nextChapterPurpose = "承接剧情";

            // 解析章节蓝图获取下章信息
            if (generatedData.blueprint) {
                const blueprintLines = generatedData.blueprint.split('\n');
                const nextChapterRegex = new RegExp(`### 第${chapterNum + 1}章 -`);

                let inNextChapter = false;
                for (const line of blueprintLines) {
                    if (nextChapterRegex.test(line)) {
                        inNextChapter = true;
                    } else if (inNextChapter) {
                        // 提取下一章的核心作用
                        if (line.includes('**核心作用：**')) {
                            nextChapterPurpose = line.replace('**核心作用：**', '').trim();
                            break; // 找到下一章作用后退出循环
                        }
                    }
                }
            }

            // 查找最合适的状态存档
            const latestArchive = findLatestStateArchive(chapterNum);

            const variables = {
                novel_number: chapterNum,
                chapter_title: params.title || `第${chapterNum}章`,
                chapter_role: params.role || "推进剧情",
                chapter_purpose: params.purpose || "承上启下",
                suspense_level: params.suspense || "正常",
                foreshadowing: params.foreshadowing || "无",
                plot_twist_level: params.twist || "低",
                short_summary: params.summary || "暂无摘要",
                selected_theme_info: theme ? `已选题材公式：${theme.name} - ${theme.desc}` : '未指定特定题材公式，请自行发挥',
                character_state: latestArchive.characterState,
                world_building: generatedData.world || "暂无世界观设定",
                plot_architecture: generatedData.plot || "暂无情节架构",
                custom_requirements: inputs.customRequirements || "无",
                novel_title: String(inputs.novelTitle || "未命名"),
                tone: String(inputs.tone || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                word_count: String(inputs.wordCount || 2000),
                CHAPTER_BLUEPRINT: generatedData.blueprint || "暂无章节蓝图",
                global_summary: latestArchive.globalSummary,
                previous_chapter_excerpt: previousContent,
                chapter_summary: latestArchive.chapterSummary || "暂无摘要",
                next_chapter_number: chapterNum + 1,
                next_chapter_title: `第${chapterNum + 1}章`,
                next_chapter_purpose: nextChapterPurpose
            };

            const prompt = formatPrompt(template, variables);
            const wordCount = parseInt(inputs.wordCount || 2000);
            const rawResult = await generateContent(prompt, `请创作第${chapterNum}章`, apiConfig, wordCount);

            // 只清理标题，不裁剪内容，确保AI生成的内容完整
            const cleanContent = rawResult.replace(/^##\s*第\d+章.*$/m, '').trim();

            const newChapter: Chapter = {
                title: params.title,
                content: cleanContent,
                ...params
            };

            setGeneratedData(prev => {
                const newChapters = [...prev.chapters];
                newChapters[chapterNum - 1] = newChapter;
                return { ...prev, chapters: newChapters };
            });

        } catch (e: any) {
            showAlert("章节生成失败: " + e.message, "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRewriteChapter = (chapterNum: number, content: string) => {
        setGeneratedData(prev => {
            const newChapters = [...prev.chapters];
            if (newChapters[chapterNum - 1]) {
                newChapters[chapterNum - 1] = {
                    ...newChapters[chapterNum - 1],
                    content: content
                };
            }
            return { ...prev, chapters: newChapters };
        });
    };

    const handleUpdateChapterTitle = (chapterNum: number, title: string) => {
        setGeneratedData(prev => {
            const newChapters = [...prev.chapters];
            if (newChapters[chapterNum - 1]) {
                newChapters[chapterNum - 1].title = title;
            }
            return { ...prev, chapters: newChapters };
        });
    };

    const handleSyncContext = async (chapterNum: number) => {
        const currentChapter = generatedData.chapters[chapterNum - 1];
        if (!currentChapter || !currentChapter.content) {
            showAlert("当前章节无内容，无法同步。", "warning");
            return;
        }

        setLoadingMessage("正在分析章节内容，同步全局摘要与角色状态...");
        setIsSyncingContext(true);
        try {
            const template = customPrompts['STATE_UPDATE'] || PROMPTS.STATE_UPDATE;

            // 优化上下文内容，只传递关键信息，提高AI生成的准确性
            // 对于长章节，只传递最近的部分内容，避免上下文过多
            const maxChapterLength = 1000; // 最大章节内容长度
            const chapterText = currentChapter.content.length > maxChapterLength
                ? `...${currentChapter.content.slice(-maxChapterLength)}`
                : currentChapter.content;

            const variables = {
                chapter_text: chapterText,
                global_summary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
                character_state: generatedData.state || "暂无角色状态",
                // 只传递当前章节相关的蓝图内容，避免上下文过多
                chapter_blueprint: generatedData.blueprint
                    ? generatedData.blueprint.split('###').find(section => section.includes(`第${chapterNum}章`)) || "暂无当前章节蓝图"
                    : "暂无章节蓝图",
                novel_number: chapterNum,
                chapter_title: currentChapter.title || `第${chapterNum}章`
            };

            const prompt = formatPrompt(template, variables);
            const result = await generateContent(prompt, "同步上下文任务", apiConfig);

            // 添加调试日志
            console.log('[Sync Context] AI生成结果:', result);

            // 改进正则表达式，使其更灵活，能够匹配不同格式的输出
            const globalSummaryMatch = result.match(/##\s*(?:全局故事摘要|GLOBAL_SUMMARY_UPDATED)[\s\S]*?(?=##\s*(?:角色状态档案|CHARACTER_STATE_UPDATED|当前章节摘要|CURRENT_CHAPTER_SUMMARY)|$)/i);
            const charStateMatch = result.match(/##\s*(?:角色状态档案|CHARACTER_STATE_UPDATED)[\s\S]*?(?=##\s*(?:当前章节摘要|CURRENT_CHAPTER_SUMMARY|$))/i);
            const chapSummaryMatch = result.match(/##\s*(?:当前章节摘要|CURRENT_CHAPTER_SUMMARY)[\s\S]*$/i);

            // 提取匹配内容，处理不同格式
            const extractContent = (match: RegExpMatchArray | null) => {
                if (!match) return null;
                // 移除标题行，只保留内容
                return match[0].replace(/^##\s*(?:.*?)\n/i, '').trim();
            };

            const globalSummaryContent = extractContent(globalSummaryMatch);
            const charStateContent = extractContent(charStateMatch);
            const chapSummaryContent = extractContent(chapSummaryMatch);

            // 增强容错处理，确保至少有一部分内容生成
            if (globalSummaryContent || charStateContent || chapSummaryContent) {
                setGeneratedData(prev => {
                    const newData = { ...prev };

                    // 更新全局摘要
                    if (globalSummaryContent) {
                        newData.globalSummary = globalSummaryContent;
                    }

                    // 更新角色状态
                    if (charStateContent) {
                        newData.state = charStateContent;
                    }

                    // 更新章节摘要
                    if (chapSummaryContent) {
                        const newChapters = [...prev.chapters];
                        if (newChapters[chapterNum - 1]) {
                            newChapters[chapterNum - 1].summary = chapSummaryContent;
                        }
                        newData.chapters = newChapters;
                    }

                    // 创建新的存档，使用现有内容作为备份
                    const newArchive: StateArchive = {
                        chapterNum: chapterNum,
                        title: `第${chapterNum}章存档`,
                        globalSummary: globalSummaryContent || newData.globalSummary || "暂无",
                        characterState: charStateContent || newData.state || "暂无",
                        chapterSummary: chapSummaryContent || newData.chapters[chapterNum - 1]?.summary || "暂无",
                        timestamp: Date.now()
                    };

                    const history = [...(prev.stateHistory || [])];
                    const existingIdx = history.findIndex(h => h.chapterNum === chapterNum);
                    if (existingIdx >= 0) {
                        history[existingIdx] = newArchive;
                    } else {
                        history.push(newArchive);
                    }
                    newData.stateHistory = history.sort((a, b) => a.chapterNum - b.chapterNum);

                    return newData;
                });

                // 提示用户同步成功，并告知生成了哪些内容
                let successMessage = "上下文同步成功！\n已归档至角色状态库。\n\n生成内容：";
                if (globalSummaryContent) successMessage += "\n- 全局故事摘要";
                if (charStateContent) successMessage += "\n- 角色状态档案";
                if (chapSummaryContent) successMessage += "\n- 当前章节摘要";
                showAlert(successMessage, "success");
            } else {
                throw new Error("AI 返回格式不符合预期，同步失败。");
            }

        } catch (e: any) {
            showAlert("同步失败: " + e.message, "error");
        } finally {
            setIsSyncingContext(false);
        }
    };

    const openCustomModal = (title: string, callback: (val: string) => void) => {
        setCustomModalTitle(title);
        // 使用ref保存回调函数和标题，确保同步更新
        customPromptCallbackRef.current = callback;
        currentModalTitleRef.current = title;
        setShowCustomRequestModal(true);
    };

    // 生成完整提示词的函数
    const generateFullPrompt = (promptKey: string, chapterNum?: number) => {
        if (!promptKey) return;

        // 生成完整提示词
        const template = customPrompts[promptKey] || PROMPTS[promptKey as keyof typeof PROMPTS] || "";

        let variables: any = {};

        // 根据不同的promptKey设置不同的变量
        if (promptKey === 'CHAPTER_1' || promptKey === 'CHAPTER_NEXT') {
            // 章节生成相关提示词
            // 使用传入的chapterNum或默认当前查看的章节
            let currentChapterNum = chapterNum || writingStepState.viewChapter || 1;

            // 根据promptKey强制设置正确的章节号
            if (promptKey === 'CHAPTER_1') {
                // 首章创作强制使用第1章
                currentChapterNum = 1;
            } else if (promptKey === 'CHAPTER_NEXT') {
                // 后续章节确保章节号大于等于2
                currentChapterNum = Math.max(currentChapterNum, 2);
            }

            const isFirstChapter = currentChapterNum === 1;
            let previousContent = "";
            if (!isFirstChapter) {
                const prevChap = generatedData.chapters[currentChapterNum - 2];
                previousContent = prevChap ? prevChap.content.slice(-800) : "无前文";
            }

            // 从章节蓝图中获取当前章节的详细信息
            let chapterRole = "推进剧情";
            let chapterPurpose = "承上启下";
            let suspenseLevel = "正常";
            let foreshadowing = "无";
            let plotTwistLevel = "低";
            let chapterTitle = "暂无标题";
            let shortSummary = "暂无摘要";
            let nextChapterPurpose = "承接剧情";

            // 解析章节蓝图获取当前章节和下章信息
            if (generatedData.blueprint) {
                const blueprintLines = generatedData.blueprint.split('\n');
                const currentChapterRegex = new RegExp(`### 第${currentChapterNum}章 -`);
                const nextChapterRegex = new RegExp(`### 第${currentChapterNum + 1}章 -`);

                let inCurrentChapter = false;
                let inNextChapter = false;
                for (const line of blueprintLines) {
                    if (currentChapterRegex.test(line)) {
                        inCurrentChapter = true;
                        inNextChapter = false;
                        // 提取章节标题
                        const titleMatch = line.match(/- (.+)$/);
                        if (titleMatch) {
                            chapterTitle = titleMatch[1];
                        }
                    } else if (nextChapterRegex.test(line)) {
                        inCurrentChapter = false;
                        inNextChapter = true;
                    } else if (inCurrentChapter) {
                        if (line.includes('**本章定位：**')) {
                            chapterRole = line.replace('**本章定位：**', '').trim();
                        } else if (line.includes('**核心作用：**')) {
                            chapterPurpose = line.replace('**核心作用：**', '').trim();
                        } else if (line.includes('**悬念密度：**')) {
                            suspenseLevel = line.replace('**悬念密度：**', '').trim();
                        } else if (line.includes('**伏笔操作：**')) {
                            foreshadowing = line.replace('**伏笔操作：**', '').trim();
                        } else if (line.includes('**认知颠覆：**')) {
                            const twistMatch = line.match(/★+/);
                            if (twistMatch) {
                                const twistStars = twistMatch[0].length;
                                if (twistStars >= 4) plotTwistLevel = "高";
                                else if (twistStars >= 2) plotTwistLevel = "中";
                                else plotTwistLevel = "低";
                            }
                        } else if (line.includes('**本章简述：**')) {
                            shortSummary = line.replace('**本章简述：**', '').trim();
                        }
                    } else if (inNextChapter) {
                        // 提取下一章的核心作用
                        if (line.includes('**核心作用：**')) {
                            nextChapterPurpose = line.replace('**核心作用：**', '').trim();
                            break; // 找到下一章作用后退出循环
                        }
                    }
                }
            }

            // 查找最合适的状态存档
            const latestArchive = findLatestStateArchive(currentChapterNum);

            variables = {
                novel_number: currentChapterNum,
                chapter_title: generatedData.chapters[currentChapterNum - 1]?.title || `第${currentChapterNum}章`,
                chapter_role: chapterRole,
                chapter_purpose: chapterPurpose,
                suspense_level: suspenseLevel,
                foreshadowing: foreshadowing,
                plot_twist_level: plotTwistLevel,
                short_summary: shortSummary,
                selected_theme_info: writingStepState?.selectedTheme ? `${writingStepState.selectedTheme.name} - ${writingStepState.selectedTheme.desc}` : '未指定特定题材公式，请自行发挥',
                character_state: latestArchive.characterState,
                world_building: generatedData.world || "暂无世界观设定",
                plot_architecture: generatedData.plot || "暂无情节架构",
                custom_requirements: inputs.customRequirements || "无",
                perspective: String(inputs.perspective || "未指定"),
                word_count: String(inputs.wordCount || 2000),
                CHAPTER_BLUEPRINT: generatedData.blueprint || "暂无章节蓝图",
                global_summary: latestArchive.globalSummary,
                previous_chapter_excerpt: previousContent,
                chapter_summary: latestArchive.chapterSummary || "暂无摘要",
                next_chapter_number: currentChapterNum + 1,
                next_chapter_title: `第${currentChapterNum + 1}章`,
                next_chapter_purpose: nextChapterPurpose
            };
        } else if (promptKey === 'STATE_UPDATE') {
            // 状态更新相关提示词
            const currentChapterNum = chapterNum || writingStepState.viewChapter || 1;
            const currentChapter = generatedData.chapters[currentChapterNum - 1];

            variables = {
                chapter_text: currentChapter?.content || "暂无章节内容",
                global_summary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
                character_state: generatedData.state || "暂无角色状态",
                chapter_blueprint: generatedData.blueprint || "暂无章节蓝图",
                novel_number: currentChapterNum,
                chapter_title: currentChapter?.title || `第${currentChapterNum}章`
            };
        } else {
            // 通用提示词变量
            // 获取对应的步骤ID
            const step = STEPS.find(s => s.promptKey === promptKey);
            // 获取该步骤的自定义修改意见
            const customInstruction = step ? stepCustomInstructions[step.id] || "无" : "无";

            variables = {
                novel_title: String(inputs.novelTitle || "未命名"),
                topic: String(inputs.topic || ""),
                genre: String(inputs.genre || ""),
                tone: String(inputs.tone || "未指定"),
                ending: String(inputs.ending || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                number_of_chapters: String(inputs.numberOfChapters || 10),
                word_count: String(inputs.wordCount || 2000),
                custom_requirements: String(inputs.customRequirements || "无"),
                custom_instruction: customInstruction,
                STORY_DNA: String(generatedData.dna || "暂无核心DNA"),
                character_dynamics: String(generatedData.characters || "暂无角色设定"),
                world_building: String(generatedData.world || "暂无世界观设定"),
                plot_architecture: String(generatedData.plot || "暂无情节架构"),
                plot_structure: selectedPlotStructure
            };
        }

        const completePrompt = formatPrompt(template, variables);
        setFullPrompt(completePrompt);
    };

    const handleShowPrompt = (promptKey: string) => {
        if (promptKey) {
            setEditingPromptKey(promptKey);

            // 生成完整提示词
            generateFullPrompt(promptKey);

            setIsFullPromptView(false); // 默认为模板视图

            setShowPromptModal(true);
        }
    };

    // 监听editingPromptKey变化，重新生成完整提示词
    useEffect(() => {
        if (editingPromptKey && showPromptModal) {
            generateFullPrompt(editingPromptKey);
        }
    }, [editingPromptKey, showPromptModal, customPrompts, PROMPTS, generatedData, inputs, stepCustomInstructions, writingStepState.viewChapter]);

    const handleSavePrompt = (newPrompt: string) => {
        if (editingPromptKey) {
            setCustomPrompts(prev => ({
                ...prev,
                [editingPromptKey]: newPrompt
            }));
        }
    };

    const getActivePrompt = (key: string) => {
        if (key === 'THEME_MATCH_PROMPT') return customPrompts[key] || THEME_MATCH_PROMPT;
        if (key === 'STATE_UPDATE') return customPrompts[key] || PROMPTS.STATE_UPDATE;
        return customPrompts[key] || PROMPTS[key as keyof typeof PROMPTS] || "";
    };

    const getDefaultPrompt = (key: string) => {
        if (key === 'THEME_MATCH_PROMPT') return THEME_MATCH_PROMPT;
        if (key === 'STATE_UPDATE') return PROMPTS.STATE_UPDATE;
        return PROMPTS[key as keyof typeof PROMPTS] || "";
    };

    const renderContent = () => {
        if (currentStep === 0) {
            return (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-xl">
                        <div className="flex justify-between items-center bg-stone-900 p-4 rounded-xl border border-stone-800">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                <BookOpen className="mr-2 text-orange-400" size={24} />
                                创作灵感初始化
                            </h2>
                        </div>

                        <div className="space-y-6">
                            {/* 核心信息组 */}
                            <div className="bg-stone-800/30 border border-stone-700/50 rounded-lg p-4 sm:p-5">
                                <h3 className="text-sm font-semibold text-orange-400 uppercase mb-4 flex items-center">
                                    <BookOpen size={16} className="mr-2" />
                                    核心设定
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-stone-400 mb-2">
                                            核心脑洞 (Topic) <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <textarea
                                            className="w-full min-h-[120px] sm:h-36 bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none transition-all hover:border-orange-700"
                                            placeholder="请输入您的故事核心创意，例如：一个在修仙世界卖保险的穿越者，必须靠理赔来提升修为..."
                                            value={inputs.topic}
                                            onChange={(e) => setInputs(prev => ({ ...prev, topic: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 基础信息组 */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-stone-800/30 border border-stone-700/50 rounded-lg p-4 sm:p-5">
                                    <h3 className="text-sm font-semibold text-emerald-400 uppercase mb-4 flex items-center">
                                        <List size={16} className="mr-2" />
                                        基础属性
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-stone-400 mb-2">
                                                题材分类 (Genre)
                                            </label>
                                            <select
                                                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all hover:border-orange-700"
                                                value={inputs.genre}
                                                onChange={(e) => setInputs(prev => ({ ...prev, genre: e.target.value }))}
                                            >
                                                <option value="">请选择题材...</option>
                                                <optgroup label="男频">
                                                    {TAGS.male.filter(t => t !== '全部').map(t => <option key={t} value={t}>{t}</option>)}
                                                </optgroup>
                                                <optgroup label="女频">
                                                    {TAGS.female.filter(t => t !== '全部').map(t => <option key={t} value={t}>{t}</option>)}
                                                </optgroup>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-stone-400 mb-2">
                                                叙事视角
                                            </label>
                                            <select
                                                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all hover:border-orange-700"
                                                value={inputs.perspective}
                                                onChange={(e) => setInputs(prev => ({ ...prev, perspective: e.target.value }))}
                                            >
                                                <option value="">请选择视角...</option>
                                                {NARRATIVE_PERSPECTIVES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-stone-400 mb-2">
                                                故事基调
                                            </label>
                                            <select
                                                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all hover:border-orange-700"
                                                value={inputs.tone}
                                                onChange={(e) => setInputs(prev => ({ ...prev, tone: e.target.value }))}
                                            >
                                                <option value="">请选择故事基调...</option>
                                                {STORY_TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-stone-400 mb-2">
                                                结局倾向
                                            </label>
                                            <select
                                                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all hover:border-orange-700"
                                                value={inputs.ending}
                                                onChange={(e) => setInputs(prev => ({ ...prev, ending: e.target.value }))}
                                            >
                                                <option value="">请选择结局...</option>
                                                {ENDING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* 格式与要求组 */}
                                <div className="bg-stone-800/30 border border-stone-700/50 rounded-lg p-4 sm:p-5">
                                    <h3 className="text-sm font-semibold text-amber-400 uppercase mb-4 flex items-center">
                                        <LayoutDashboard size={16} className="mr-2" />
                                        格式与要求
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-stone-400 mb-2">
                                                小说名称
                                            </label>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all hover:border-orange-700"
                                                    placeholder="输入小说名称或点击AI生成..."
                                                    value={inputs.novelTitle}
                                                    onChange={(e) => setInputs(prev => ({ ...prev, novelTitle: e.target.value }))}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        // 检查API配置
                                                        if (!apiConfig.apiKey) {
                                                            setShowConfigModal(true);
                                                            return;
                                                        }

                                                        if (!inputs.topic || !inputs.genre) {
                                                            showAlert('请先填写核心脑洞和题材分类', "warning");
                                                            return;
                                                        }
                                                        setIsGenerating(true);
                                                        try {
                                                            const systemPrompt = "你是一个专业的小说命名专家，擅长根据小说创意生成吸引人的书名。";
                                                            const userPrompt = `根据以下信息生成一个吸引人的小说名称（只返回书名，不要其他内容）：\n核心创意：${inputs.topic}\n题材：${inputs.genre}\n基调：${inputs.tone || '未指定'}\n\n要求：\n1. 书名要简洁有力，3-8个字\n2. 要体现核心创意和题材特点\n3. 要有吸引力和记忆点\n4. 只返回书名本身，不要引号或其他说明`;

                                                            const result = await generateContent(systemPrompt, userPrompt, apiConfig);
                                                            const title = result.trim().replace(/["""]/g, '');
                                                            setInputs(prev => ({ ...prev, novelTitle: title }));
                                                        } catch (error) {
                                                            console.error('生成书名失败:', error);
                                                            showAlert('生成失败，请检查API配置', "error");
                                                        } finally {
                                                            setIsGenerating(false);
                                                        }
                                                    }}
                                                    disabled={isGenerating || !inputs.topic || !inputs.genre}
                                                    className="px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
                                                >
                                                    {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                    AI生成
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-stone-400 mb-2">
                                                    预计章节数
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all hover:border-orange-700"
                                                    value={inputs.numberOfChapters || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        setInputs(prev => ({
                                                            ...prev,
                                                            numberOfChapters: value ? parseInt(value) : 0
                                                        }));
                                                    }}
                                                    placeholder="12"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-stone-400 mb-2">
                                                    每章字数
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all hover:border-orange-700"
                                                    value={inputs.wordCount || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        setInputs(prev => ({
                                                            ...prev,
                                                            wordCount: value ? parseInt(value) : 0
                                                        }));
                                                    }}
                                                    placeholder="2000"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-stone-400 mb-2">
                                                自定义特殊要求
                                            </label>
                                            <textarea
                                                className="w-full min-h-[100px] sm:h-32 bg-stone-950 border border-stone-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none transition-all hover:border-orange-700"
                                                placeholder="额外的设定要求，如：主角必须是反派、不要系统流、加入科幻元素..."
                                                value={inputs.customRequirements}
                                                onChange={(e) => setInputs(prev => ({ ...prev, customRequirements: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end items-center">
                            <button
                                onClick={() => {
                                    // 检查核心脑洞是否填写
                                    if (!inputs.topic.trim()) {
                                        showAlert('请填写核心脑洞后才能继续下一步', "warning");
                                        return;
                                    }
                                    // 标记创作初始化为已完成
                                    setIsInitCompleted(true);
                                    setCurrentStep(1);
                                }}
                                disabled={!inputs.topic.trim()}
                                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
                            >
                                下一步：生成核心架构
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (STEPS[currentStep].id === 'writing') {
            return (
                <WritingStep
                    inputs={inputs}
                    generatedData={generatedData}
                    onGenerate={handleGenerateChapter}
                    onRewrite={handleRewriteChapter}
                    onUpdateChapterTitle={handleUpdateChapterTitle}
                    isGenerating={isGenerating}
                    isSyncingContext={isSyncingContext}
                    loadingMessage={loadingMessage}
                    copyToClipboard={copyToClipboard}
                    apiConfig={apiConfig}
                    onEditPrompt={!__HIDE_PROMPT_MANAGEMENT__ ? handleShowPrompt : undefined}
                    onSyncContext={handleSyncContext}
                    onUpdateViewChapter={(chapterNum) => setWritingStepState(prev => ({ ...prev, viewChapter: chapterNum }))}
                    onUpdateSelectedTheme={(theme) => setWritingStepState(prev => ({ ...prev, selectedTheme: theme }))}
                    viewChapter={writingStepState.viewChapter}
                    selectedTheme={writingStepState.selectedTheme}
                />
            );
        }

        const currentStepId = STEPS[currentStep].id as keyof GeneratedData;
        const content = generatedData[currentStepId];

        if (currentStepId === 'dna') {
            return (
                <div className="flex flex-col space-y-4">
                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-stone-900 p-4 rounded-xl border border-stone-800">
                        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center">
                            {React.createElement(STEPS[currentStep].icon, { className: "mr-2 text-orange-400", size: 22 })}
                            {STEPS[currentStep].title}
                        </h2>
                        <div className="flex space-x-2 sm:space-x-3 flex-wrap justify-end w-full sm:w-auto">
                            {currentStepId === 'dna' && (
                                <>
                                    {!__HIDE_PROMPT_MANAGEMENT__ && (
                                        <button
                                            onClick={() => handleShowPrompt('JUDGE')}
                                            className="text-stone-500 hover:text-white transition-colors p-3 rounded-lg hover:bg-stone-800"
                                            title="编辑判官提示词"
                                        >
                                            <FileText size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={handleJudge}
                                        disabled={isJudging}
                                        className={`px-4 py-3 bg-red-900/50 hover:bg-red-800/50 border border-red-800 text-red-200 rounded-lg flex items-center transition-all ${isJudging ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'} min-h-[48px] justify-center`}
                                    >
                                        {isJudging ? <RefreshCw size={18} className="mr-2 animate-spin" /> : <Gavel size={18} className="mr-2" />}
                                        {isJudging ? '审判中...' : '判官审题'}
                                    </button>
                                </>
                            )}

                            {content && (
                                <button
                                    onClick={() => openCustomModal(STEPS[currentStep].title, (val) => handleGenerateStep(currentStepId, val))}
                                    className="flex items-center px-4 py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-lg transition-colors border border-stone-700 min-h-[48px] justify-center"
                                >
                                    <RefreshCw size={16} className="mr-2" /> 重写/修改
                                </button>
                            )}
                            <button
                                onClick={() => handleGenerateStep(currentStepId)}
                                disabled={isGenerating}
                                className={`flex items-center px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'shadow-lg hover:shadow-orange-500/20'} min-h-[48px] justify-center`}
                            >
                                {isGenerating ? <RefreshCw className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                                {content ? '重新生成' : '立即生成'}
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 sm:p-6 overflow-y-auto min-h-[300px] max-h-[60vh] relative">
                        {isGenerating ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/90 z-10">
                                <RefreshCw className="animate-spin w-12 h-12 text-orange-500 mb-4" />
                                <p className="text-orange-300 font-mono animate-pulse text-center px-4">{loadingMessage || "AI 正在深度思考构建中..."}</p>
                            </div>
                        ) : content ? (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* 显示生成的核心DNA（包含基础设定） */}
                                <div>
                                    <div className="flex justify-end mb-4">
                                        <button onClick={() => copyToClipboard(content as string)} className="text-stone-500 hover:text-white transition-colors p-3 rounded-lg hover:bg-stone-800"
                                            title="复制核心DNA"
                                        >
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                    <MarkdownViewer content={content as string} />
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-stone-500 opacity-50">
                                <BookOpen size={64} className="mb-4" />
                                <p>点击上方“生成”按钮开始构建</p>
                            </div>
                        )}
                    </div>

                    {/* Next Step Button */}
                    {currentStep < STEPS.length - 1 && content && (
                        <div className="flex justify-end p-4 sm:p-0">
                            <button
                                onClick={() => setCurrentStep(currentStep + 1)}
                                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105 hover:shadow-xl"
                            >
                                下一步：{STEPS[currentStep + 1].title}
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        if (currentStepId === 'state') {
            const history = generatedData.stateHistory || [];
            const currentArchive = history.find(h => h.chapterNum === viewArchiveChapter) || history[0];

            if (!content && history.length === 0) {
                return (
                    <div className="h-full flex flex-col space-y-4">
                        <div className="flex justify-between items-center bg-stone-900 p-4 rounded-xl border border-stone-800">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                <Activity className="mr-2 text-orange-400" size={24} />
                                角色状态库 (State Archives)
                            </h2>
                            <button
                                onClick={() => handleGenerateStep('state')}
                                disabled={isGenerating}
                                className={`flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all ${isGenerating ? 'opacity-50' : ''}`}
                            >
                                {isGenerating ? <RefreshCw className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
                                生成初始状态
                            </button>
                        </div>
                        <div className="flex flex-col items-center justify-center h-full text-stone-500">
                            <Archive size={64} className="mb-4 opacity-50" />
                            <p>暂无存档记录，请点击生成初始状态</p>
                        </div>
                    </div>
                );
            } else {
                return (
                    <div className="h-full flex flex-col space-y-4">
                        <div className="flex flex-wrap items-center justify-between bg-stone-900 p-4 rounded-xl border border-stone-800 shadow-lg gap-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center">
                                <Activity className="mr-2 text-orange-400" size={20} sm:size={24} />
                                角色状态库 (State Archives)
                            </h2>

                            {/* 中间提示信息 - 在移动端隐藏 */}
                            <div className="hidden sm:flex flex-1 justify-center mx-4">
                                <div className="flex items-center text-sm text-amber-300 bg-amber-900/30 px-3 py-1 rounded-full border border-amber-800">
                                    💡 提示：完成章节创作后，点击右上角 <Activity size={16} className="inline-block align-middle" /> 图标更新角色状态
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-end">
                                {history.length > 0 && (
                                    <div className="relative flex-shrink-0">
                                        <select
                                            value={viewArchiveChapter}
                                            onChange={(e) => setViewArchiveChapter(parseInt(e.target.value))}
                                            className="appearance-none bg-stone-800 text-white pl-4 pr-10 py-2 rounded-lg border border-stone-700 focus:outline-none focus:border-orange-500 font-mono text-xs sm:text-sm shadow-sm hover:border-stone-600 transition-all min-w-[120px]"
                                        >
                                            {history.map(h => (
                                                <option key={h.chapterNum} value={h.chapterNum}>
                                                    {h.title}
                                                </option>
                                            ))}
                                        </select>
                                        <Clock className="absolute right-3 top-2.5 text-stone-400 pointer-events-none" size={16} />
                                    </div>
                                )}

                                <button
                                    onClick={() => handleGenerateStep('state')}
                                    disabled={isGenerating}
                                    className={`flex items-center px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''} text-xs sm:text-sm whitespace-nowrap`}
                                >
                                    {isGenerating ? <RefreshCw size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
                                    {history.length > 0 ? '重置初始状态' : '生成初始状态'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 bg-stone-900 border border-stone-800 rounded-xl shadow-lg overflow-hidden">
                            {currentArchive ? (
                                <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-0">
                                    {/* 左侧信息区 */}
                                    <div className="col-span-1 lg:col-span-1 p-4 sm:p-6 overflow-y-auto bg-stone-950/50 border-r border-stone-800">
                                        <div className="space-y-4 sm:space-y-6">
                                            <div className="bg-stone-800/30 rounded-xl p-4 sm:p-5 border border-stone-700/50 shadow-inner">
                                                <h3 className="text-xs sm:text-sm font-bold text-orange-300 uppercase mb-2 sm:mb-3 flex items-center">
                                                    <Globe size={14} sm:size={16} className="mr-2" />
                                                    全局故事摘要
                                                </h3>
                                                <div className="max-h-48 sm:max-h-60 overflow-y-auto custom-scrollbar pr-2 text-sm">
                                                    <MarkdownViewer content={currentArchive.globalSummary} compact />
                                                </div>
                                            </div>

                                            <div className="bg-stone-800/30 rounded-xl p-4 sm:p-5 border border-stone-700/50 shadow-inner">
                                                <h3 className="text-xs sm:text-sm font-bold text-emerald-300 uppercase mb-2 sm:mb-3 flex items-center">
                                                    <FileText size={14} sm:size={16} className="mr-2" />
                                                    本章摘要
                                                </h3>
                                                <div className="max-h-48 sm:max-h-60 overflow-y-auto custom-scrollbar pr-2 text-sm">
                                                    <MarkdownViewer content={currentArchive.chapterSummary} compact />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 右侧角色状态区 */}
                                    <div className="col-span-1 lg:col-span-2 p-4 sm:p-6 min-h-full overflow-y-auto">
                                        <div className="bg-stone-800/30 rounded-xl p-4 sm:p-5 border border-stone-700/50 shadow-inner">
                                            <h3 className="text-xs sm:text-sm font-bold text-amber-300 uppercase mb-2 sm:mb-3 flex items-center">
                                                <Users size={14} sm:size={16} className="mr-2" />
                                                角色状态档案
                                            </h3>
                                            <div className="text-sm">
                                                <MarkdownViewer content={currentArchive.characterState} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-stone-500">
                                    <Archive size={48} className="mb-4 opacity-50" />
                                    <p>暂无存档记录</p>
                                </div>
                            )}
                        </div>

                        {/* Next Step Button */}
                        {currentStep < STEPS.length - 1 && (
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={() => setCurrentStep(currentStep + 1)}
                                    className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105 hover:shadow-xl"
                                >
                                    下一步：{STEPS[currentStep + 1].title}
                                </button>
                            </div>
                        )}
                    </div>
                );
            }
        }

        return (
            <div className="flex flex-col space-y-4">
                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-stone-900 p-4 rounded-xl border border-stone-800">
                    {/* 左侧：标题 */}
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center">
                        {React.createElement(STEPS[currentStep].icon, { className: "mr-2 text-orange-400", size: 22 })}
                        {STEPS[currentStep].title}
                    </h2>

                    {/* 中间：选择剧情结构按钮 */}
                    <div className="flex justify-center flex-1">
                        {currentStepId === 'plot' && (
                            <button
                                onClick={() => setShowPlotStructureModal(true)}
                                className="flex items-center px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white rounded-lg transition-all hover:shadow-lg"
                            >
                                <LayoutList size={18} className="mr-2 text-orange-400" />
                                结构: {selectedPlotStructure}
                            </button>
                        )}
                    </div>

                    {/* 右侧：其他按钮组 */}
                    <div className="flex space-x-2 sm:space-x-3 flex-wrap justify-end w-full sm:w-auto">
                        {currentStepId === 'dna' && (
                            <>
                                {!__HIDE_PROMPT_MANAGEMENT__ && (
                                    <button
                                        onClick={() => handleShowPrompt('JUDGE')}
                                        className="text-stone-500 hover:text-white transition-colors p-3 rounded-lg hover:bg-stone-800"
                                        title="编辑判官提示词"
                                    >
                                        <FileText size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={handleJudge}
                                    disabled={isJudging}
                                    className={`px-4 py-3 bg-red-900/50 hover:bg-red-800/50 border border-red-800 text-red-200 rounded-lg flex items-center transition-all ${isJudging ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'} min-h-[48px] justify-center`}
                                >
                                    {isJudging ? <RefreshCw size={18} className="mr-2 animate-spin" /> : <Gavel size={18} className="mr-2" />}
                                    {isJudging ? '审判中...' : '判官审题'}
                                </button>
                            </>
                        )}

                        {content && (
                            <button
                                onClick={() => openCustomModal(STEPS[currentStep].title, (val) => handleGenerateStep(currentStepId, val))}
                                className="flex items-center px-4 py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-lg transition-colors border border-stone-700 min-h-[48px] justify-center"
                            >
                                <RefreshCw size={16} className="mr-2" /> 重写/修改
                            </button>
                        )}
                        <button
                            onClick={() => handleGenerateStep(currentStepId)}
                            disabled={isGenerating}
                            className={`flex items-center px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'shadow-lg hover:shadow-orange-500/20'} min-h-[48px] justify-center`}
                        >
                            {isGenerating ? <RefreshCw className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                            {content ? '重新生成' : '立即生成'}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 sm:p-6 overflow-y-auto min-h-[300px] max-h-[60vh] relative">
                    {isGenerating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/90 z-10">
                            <RefreshCw className="animate-spin w-12 h-12 text-orange-500 mb-4" />
                            <p className="text-orange-300 font-mono animate-pulse text-center px-4">{loadingMessage || "AI 正在深度思考构建中..."}</p>
                        </div>
                    ) : content ? (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex justify-end mb-4">
                                <button onClick={() => copyToClipboard(content as string)} className="text-stone-500 hover:text-white transition-colors p-3 rounded-lg hover:bg-stone-800"
                                    title="复制内容"
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                            <MarkdownViewer content={cleanCodeBlock(content as string)} />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-stone-500 opacity-50">
                            <BookOpen size={64} className="mb-4" />
                            <p>点击上方“生成”按钮开始构建</p>
                        </div>
                    )}
                </div>

                {/* Next Step Button */}
                {currentStep < STEPS.length - 1 && content && (
                    <div className="flex justify-end p-4 sm:p-0">
                        <button
                            onClick={() => setCurrentStep(currentStep + 1)}
                            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105 hover:shadow-xl"
                        >
                            下一步：{STEPS[currentStep + 1].title}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const relatedPromptKeys = (editingPromptKey === 'CHAPTER_1' || editingPromptKey === 'CHAPTER_NEXT')
        ? ['CHAPTER_1', 'CHAPTER_NEXT']
        : undefined;

    return (
        <div className="h-screen w-screen bg-stone-950 text-stone-100 flex font-sans">
            {/* 仅在未隐藏提示词管理功能时渲染提示词编辑和管理模态框 */}
            {!__HIDE_PROMPT_MANAGEMENT__ && (
                <>
                    <PromptEditorModal
                        isOpen={showPromptModal}
                        onClose={() => setShowPromptModal(false)}
                        prompt={editingPromptKey ? getActivePrompt(editingPromptKey) : ""}
                        defaultPrompt={editingPromptKey ? getDefaultPrompt(editingPromptKey) : ""}
                        fullPrompt={fullPrompt}
                        isFullPromptView={isFullPromptView}
                        onTogglePromptView={() => setIsFullPromptView(prev => !prev)}
                        onSave={handleSavePrompt}
                        currentKey={editingPromptKey || undefined}
                        relatedKeys={relatedPromptKeys}
                        onKeyChange={(key) => {
                            setEditingPromptKey(key);
                            // 根据新的提示词类型更新当前查看的章节
                            if (key === 'CHAPTER_1') {
                                // 首章创作强制使用第1章
                                setWritingStepState(prev => ({ ...prev, viewChapter: 1 }));
                            } else if (key === 'CHAPTER_NEXT') {
                                // 后续章节确保章节号大于等于2
                                setWritingStepState(prev => ({
                                    ...prev,
                                    viewChapter: Math.max(prev.viewChapter, 2)
                                }));
                            }
                        }}
                        currentChapter={writingStepState.viewChapter}
                        totalChapters={inputs.numberOfChapters}
                        onChapterChange={(chapterNum) => setWritingStepState(prev => ({ ...prev, viewChapter: chapterNum }))}
                    />

                    <PromptManagerModal
                        isOpen={showPromptManager}
                        onClose={() => setShowPromptManager(false)}
                        customPrompts={customPrompts}
                        onUpdatePrompts={setCustomPrompts}
                    />
                </>
            )}

            <CustomRequestModal
                isOpen={showCustomRequestModal}
                onClose={() => setShowCustomRequestModal(false)}
                onSubmit={(val) => {
                    // 使用ref中的回调函数和标题
                    const step = STEPS.find(s => s.title === currentModalTitleRef.current);
                    if (step) {
                        // 保存修改意见到状态中
                        setStepCustomInstructions(prev => ({
                            ...prev,
                            [step.id]: val
                        }));
                    }
                    // 调用原回调
                    customPromptCallbackRef.current(val);
                }}
                title={customModalTitle}
            />

            <ConfigModal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                config={apiConfig}
                onSave={handleConfigSave}
            />

            <JudgeResultModal
                isOpen={showJudgeModal}
                onClose={() => setShowJudgeModal(false)}
                content={judgeResult}
                onSelectProposal={handleSelectJudgeProposal}
            />

            <PlotStructureModal
                isOpen={showPlotStructureModal}
                onClose={() => setShowPlotStructureModal(false)}
                plotStructures={PLOT_STRUCTURES}
                selectedStructure={selectedPlotStructure}
                onSelectStructure={setSelectedPlotStructure}
            />

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-10 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`w-56 sm:w-64 bg-stone-900 border-r border-stone-800 flex flex-col fixed inset-y-0 left-0 z-20 transform transition-transform duration-300 md:static md:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:flex`}>
                <div className="p-6 border-b border-stone-800">
                    <img
                        src={unclecatlogo}
                        alt="猫叔 智能小说创作助手"
                        className="w-full h-auto rounded-xl"
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {STEPS.map((step, idx) => (
                        <StepCard
                            key={step.id}
                            title={step.title}
                            icon={step.icon}
                            isActive={currentStep === idx}
                            isCompleted={idx === 0 ? (
                                // 创作初始化完成条件：与其他步骤保持一致，永久标记为已完成
                                isInitCompleted
                            ) : (step.id === 'writing' ? generatedData.chapters.length > 0 : (idx > 0 && idx < 7 ? !!generatedData[step.id as keyof GeneratedData] : false))}
                            onClick={() => setCurrentStep(idx)}
                            onShowPrompt={!__HIDE_PROMPT_MANAGEMENT__ && step.promptKey ? () => handleShowPrompt(step.promptKey!) : undefined}
                        />
                    ))}
                </div>

                {/* 导入导出重置功能 */}
                <div className="p-4 border-t border-stone-800">
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <button
                                onClick={handleImport}
                                className="flex-1 bg-stone-800 hover:bg-stone-700 rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors border border-stone-700"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                导入
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex-1 bg-stone-800 hover:bg-stone-700 rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors border border-stone-700"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                导出
                            </button>
                        </div>
                        <button
                            onClick={handleReset}
                            className="w-full bg-stone-800 hover:bg-stone-700 rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors border border-stone-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                            清空/重置
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-stone-800 text-xs">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${apiConfig.apiKey ? 'bg-emerald-400' : 'bg-stone-600'}`} />
                                <span className="text-stone-400 font-medium truncate">
                                    {apiConfig.provider === 'google' ? 'Google Gemini' :
                                        apiConfig.provider === 'deepseek' ? 'DeepSeek' :
                                            apiConfig.provider === 'openai' ? 'OpenAI' :
                                                apiConfig.provider === 'claude' ? 'Anthropic Claude' :
                                                    apiConfig.provider === 'custom' ? '自定义' : '未配置'}
                                </span>
                            </div>
                            {!__HIDE_PROMPT_MANAGEMENT__ && (
                                <button
                                    onClick={() => setShowPromptManager(true)}
                                    className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-800 transition-colors shrink-0"
                                    title="提示词管理"
                                >
                                    <FileText size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-stone-500 text-[10px] ml-4 truncate flex-1 min-w-0" title={apiConfig.textModel}>
                                {/* 对于自定义模型，显示用户输入的模型名称；其他模型显示textModel */}
                                {(apiConfig.provider === 'custom' || apiConfig.textModel === 'custom') ?
                                    (apiConfig.customTextModel || apiConfig.textModel || '未选择模型') :
                                    (apiConfig.textModel || '未选择模型')}
                            </div>
                            <button
                                onClick={() => setShowConfigModal(true)}
                                className="text-stone-500 hover:text-stone-300 p-1 rounded hover:bg-stone-800 transition-colors shrink-0"
                                title="配置接口"
                            >
                                <Settings size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-stone-800/50 text-stone-600 text-center space-y-0.5">
                        <div className="text-[10px]">基于猫叔的AI小说创作系统制作</div>
                        <div className="text-[10px]">公众号：AI替代人类</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="md:hidden p-4 bg-stone-900 border-b border-stone-800 flex items-center justify-between">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-stone-800 transition-colors mr-2"
                        title="展开侧边栏"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                    </button>
                    <span className="font-bold">猫叔 智能小说创作助手</span>
                    <span className="text-sm text-stone-400">{STEPS[currentStep].title}</span>
                </header>
                <main className="flex-1 p-3 md:p-4 lg:p-8 pb-20 overflow-auto h-full">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}
