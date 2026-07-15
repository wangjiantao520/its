"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  X,
  Menu,
  Calculator,
  FileText,
  Bot,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useRouter, useSearchParams } from "next/navigation";
import { TiltIcon } from "@/components/ui/tilt-icon";
import { createAssistantStreamParser } from "@/lib/assistant-stream";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  session_id: string;
  title: string;
  last_message: string;
  updated_at: string;
}

function AssistantContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-sessions");
      const data = await res.json();
      if (data.success) {
        setSessions(data.data.list || []);
      }
    } catch (e) {
      console.error("加载会话失败", e);
    }
  }, []);

  // 加载某个会话的消息
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/agent-sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages || []);
        setCurrentSessionId(sessionId);
      }
    } catch (e) {
      console.error("加载会话详情失败", e);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    // 检查URL参数
    const sessionId = searchParams.get("session");
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [loadSessions, loadSession, searchParams]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // 自动调整textarea高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await fetch(`/api/agents/1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          session_id: currentSessionId,
          history: newMessages.slice(-10),
        }),
      });

      if (!response.ok) throw new Error("请求失败");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let streamError = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const parser = createAssistantStreamParser((event) => {
        if (event.type === "start") {
          setCurrentSessionId(event.session_id);
          void loadSessions();
        } else if (event.type === "content") {
          assistantMessage += event.content;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantMessage,
            };
            return updated;
          });
        } else if (event.type === "error") {
          streamError = event.error;
        }
      });

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.push(decoder.decode());
        parser.finish();
      }
      if (streamError) throw new Error(streamError);
    } catch (error) {
      setMessages(prev => {
        const fallback: Message = {
          role: "assistant",
          content: "抱歉，处理您的请求时出现错误，请稍后重试。",
        };
        if (prev.at(-1)?.role === "assistant" && !prev.at(-1)?.content) {
          return [...prev.slice(0, -1), fallback];
        }
        return [...prev, fallback];
      });
    } finally {
      setIsLoading(false);
      loadSessions(); // 刷新会话列表
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/agent-sessions/${sessionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        if (currentSessionId === sessionId) {
          setMessages([]);
          setCurrentSessionId(null);
        }
        setShowDeleteConfirm(null);
      }
    } catch (e) {
      console.error("删除会话失败", e);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    loadSession(sessionId);
  };

  const quickPrompts = [
    { icon: FileText, label: "帮我识别设备清单", desc: "上传图片识别设备" },
    { icon: Calculator, label: "计算维保报价", desc: "快速估算维保费用" },
    { icon: Calculator, label: "计算工程报价", desc: "辅助工程报价计算" },
    { icon: Search, label: "查询设备定额", desc: "搜索设备定额信息" },
  ];

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4">
      {/* 侧边栏 - 会话历史 */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-out ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <Card className="h-full flex flex-col overflow-hidden bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-3 pb-0 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="icon-3d-sm flex items-center justify-center">
                  <MessageSquare size={16} className="text-primary" />
                </div>
                <span className="font-semibold text-foreground">会话</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <Button
              onClick={handleNewChat}
              className="w-full gap-2 bg-gradient-to-b from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 text-white shadow-sm hover:shadow-md transition-all"
              size="sm"
            >
              <Plus size={16} />
              新建对话
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-2">
            <ScrollArea className="h-full pr-1">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <MessageSquare size={20} className="text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground/70">暂无会话记录</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    开始新对话后自动保存
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sessions.map(session => (
                    <div
                      key={session.session_id}
                      onClick={() => handleSelectSession(session.session_id)}
                      className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        currentSessionId === session.session_id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex-shrink-0">
                          <Bot
                            size={14}
                            className={
                              currentSessionId === session.session_id
                                ? "text-primary"
                                : "text-muted-foreground/60"
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`text-sm font-medium truncate ${
                              currentSessionId === session.session_id
                                ? "text-foreground"
                                : "text-foreground/80"
                            }`}
                          >
                            {session.title}
                          </h3>
                          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                            {session.last_message || "暂无消息"}
                          </p>
                          <p className="text-xs text-muted-foreground/50 mt-1">
                            {formatTime(session.updated_at)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(session.session_id, e)}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <Card className="shrink-0 mb-3 bg-card/80 backdrop-blur-sm">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Menu size={18} />
                </button>
              )}
              <div className="icon-3d flex items-center justify-center">
                <Bot size={20} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">智能报价助手</CardTitle>
                <CardDescription className="text-xs">
                  帮您快速完成设备识别、报价计算、定额查询
                </CardDescription>
              </div>
            </div>
            {currentSessionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="gap-1.5 hover:bg-primary/5 border-primary/20 text-primary/80 hover:text-primary transition-colors"
              >
                <Plus size={14} />
                新对话
              </Button>
            )}
          </CardHeader>
        </Card>

        {/* 对话区域 */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-card/80 backdrop-blur-sm">
          <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
            <ScrollArea className="flex-1 px-4 py-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 shadow-sm">
                    <Bot size={28} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    智能报价助手
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    您好！我是ITS智能报价助手，可以帮您识别设备清单、计算报价、查询定额。
                    有什么可以帮您的？
                  </p>

                  <div className="w-full grid grid-cols-2 gap-3 mb-6">
                    {quickPrompts.map(({ icon: Icon, label, desc }) => (
                      <button
                        key={label}
                        onClick={() => setInput(label)}
                        className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/30 text-left hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                      >
                        <TiltIcon className="text-primary inline-flex">
                          <Icon size={20} />
                        </TiltIcon>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {label}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-primary/95 to-primary/85 text-primary-foreground rounded-br-md shadow-sm"
                            : "bg-gradient-to-br from-card to-muted/20 text-foreground rounded-bl-md border border-border/50"
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content || (
                            <span className="inline-block w-2 h-4 bg-current animate-pulse rounded" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* 输入区域 */}
            <div className="p-4 border-t border-border/40 bg-gradient-to-t from-muted/20 to-transparent">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="输入您的问题，按 Enter 发送..."
                    className="flex-1 resize-none bg-transparent border-none focus:ring-0 text-sm placeholder:text-muted-foreground/40 min-h-[24px] max-h-[150px] p-0"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-b from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send size={16} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/50 text-center mt-2">
                  AI生成内容仅供参考，请结合实际情况核对
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>}>
      <AssistantContent />
    </Suspense>
  );
}
