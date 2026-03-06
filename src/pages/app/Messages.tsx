import { useEffect, useState, useCallback, useRef } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle, Send, Plus, Loader2, Eye, FileText, Clock,
  CheckCircle, CheckCheck, Reply, Search, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──
interface Template {
  id: string;
  name: string;
  content: string;
  category: string | null;
  variables: string[] | null;
  is_active: boolean;
}

interface Message {
  id: string;
  content: string | null;
  direction: string;
  status: string;
  channel: string;
  sent_at: string | null;
  created_at: string;
  contact_id: string | null;
  contact_name?: string;
  contact_whatsapp?: string;
  sentiment?: string | null;
}

interface Conversation {
  contact_id: string;
  contact_name: string;
  contact_whatsapp: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  messages: Message[];
}

const STATUS_ICONS: Record<string, { icon: typeof Send; label: string; color: string }> = {
  pending: { icon: Clock, label: "Pendente", color: "text-muted-foreground" },
  sent: { icon: CheckCircle, label: "Enviada", color: "text-blue-400" },
  delivered: { icon: CheckCheck, label: "Entregue", color: "text-primary" },
  received: { icon: Reply, label: "Recebida", color: "text-amber-400" },
  read: { icon: CheckCheck, label: "Lida", color: "text-primary" },
  failed: { icon: Clock, label: "Falhou", color: "text-destructive" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-pink-600",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const Messages = () => {
  const { tenantId } = useTenant();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState<Template | null>(null);
  const [showSend, setShowSend] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", category: "marketing", variables: "" });
  const [editForm, setEditForm] = useState({ name: "", content: "", category: "marketing", variables: "" });
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; whatsapp: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState("");

  // Conversation state
  const [searchConv, setSearchConv] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    const [templatesRes, messagesRes, contactsRes] = await Promise.all([
      supabase.from("whatsapp_templates").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("messages").select("*, contacts(name, whatsapp)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
      supabase.from("contacts").select("id, name, whatsapp").eq("tenant_id", tenantId).not("whatsapp", "is", null).limit(100),
    ]);

    setTemplates((templatesRes.data || []) as Template[]);
    setMessages(
      (messagesRes.data || []).map((m: any) => ({
        ...m,
        contact_name: m.contacts?.name,
        contact_whatsapp: m.contacts?.whatsapp,
      }))
    );
    setContacts((contactsRes.data || []).map((c: any) => ({ id: c.id, name: c.name, whatsapp: c.whatsapp })));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build conversations from messages
  const conversations: Conversation[] = (() => {
    const map = new Map<string, Conversation>();
    // Messages are ordered desc, iterate to build
    const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const m of sorted) {
      if (!m.contact_id) continue;
      if (!map.has(m.contact_id)) {
        map.set(m.contact_id, {
          contact_id: m.contact_id,
          contact_name: m.contact_name || "Desconhecido",
          contact_whatsapp: m.contact_whatsapp || "",
          last_message: m.content || "",
          last_time: m.sent_at || m.created_at,
          unread_count: 0,
          messages: [],
        });
      }
      const conv = map.get(m.contact_id)!;
      conv.messages.push(m);
      conv.last_message = m.content || "";
      conv.last_time = m.sent_at || m.created_at;
      if (m.direction === "inbound" && m.status !== "read") conv.unread_count++;
    }
    // Sort by last_time desc
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );
  })();

  const filteredConversations = conversations.filter((c) => {
    if (!searchConv) return true;
    const q = searchConv.toLowerCase();
    return c.contact_name.toLowerCase().includes(q) || c.last_message.toLowerCase().includes(q);
  });

  const activeConversation = conversations.find((c) => c.contact_id === activeConvId) || null;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, activeConversation?.messages.length]);

  const handleSendChat = async () => {
    if (!tenantId || !activeConvId || !chatInput.trim()) return;
    setSendingChat(true);
    const { error } = await supabase.from("messages").insert({
      tenant_id: tenantId,
      contact_id: activeConvId,
      content: chatInput.trim(),
      direction: "outbound",
      channel: "whatsapp",
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    setSendingChat(false);
    if (error) toast.error("Erro ao enviar mensagem");
    else { setChatInput(""); fetchData(); }
  };

  // ── Template handlers (kept from original) ──
  const handleCreateTemplate = async () => {
    if (!tenantId || !newTemplate.name || !newTemplate.content) { toast.error("Preencha nome e conteúdo"); return; }
    setSaving(true);
    const vars = newTemplate.variables.split(",").map((v) => v.trim()).filter(Boolean);
    const { error } = await supabase.from("whatsapp_templates").insert({
      tenant_id: tenantId, name: newTemplate.name, content: newTemplate.content,
      category: newTemplate.category, variables: vars.length > 0 ? vars : null,
    });
    setSaving(false);
    if (error) toast.error("Erro ao criar template");
    else { toast.success("Template criado!"); setShowCreate(false); setNewTemplate({ name: "", content: "", category: "marketing", variables: "" }); fetchData(); }
  };

  const handleSendManual = async () => {
    if (!tenantId || !showSend || !selectedContact) { toast.error("Selecione um contato"); return; }
    setSaving(true);
    const contact = contacts.find((c) => c.id === selectedContact);
    const { error } = await supabase.from("messages").insert({
      tenant_id: tenantId, contact_id: selectedContact, content: showSend.content,
      template_id: showSend.id, direction: "outbound", channel: "whatsapp",
      status: "sent", sent_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error("Erro ao enviar");
    else { toast.success(`Mensagem enviada para ${contact?.name}!`); setShowSend(null); setSelectedContact(""); fetchData(); }
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("whatsapp_templates").delete().eq("id", id);
    toast.success("Template removido");
    fetchData();
  };

  const renderPreviewContent = (template: Template) => {
    let content = template.content;
    (template.variables || []).forEach((v) => { content = content.replace(`{{${v}}}`, `[${v}]`); });
    return content;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>

      <Tabs defaultValue="conversations">
        <TabsList className="mb-6">
          <TabsTrigger value="conversations" className="gap-2 text-xs">
            <MessageCircle className="h-3.5 w-3.5" /> Conversas
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
        </TabsList>

        {/* ── Conversations Tab ── */}
        <TabsContent value="conversations">
          <Card className="border-border/50 overflow-hidden">
            <div className="flex h-[600px]">
              {/* Left: Contact list */}
              <div className="w-[340px] border-r border-border/50 flex flex-col">
                <div className="p-3 border-b border-border/50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conversa..."
                      value={searchConv}
                      onChange={(e) => setSearchConv(e.target.value)}
                      className="pl-9 h-9 text-sm bg-secondary/50 border-0"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {filteredConversations.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma conversa encontrada.
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <button
                        key={conv.contact_id}
                        onClick={() => setActiveConvId(conv.contact_id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50",
                          activeConvId === conv.contact_id && "bg-secondary/80"
                        )}
                      >
                        <div className={cn("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold", avatarColor(conv.contact_name))}>
                          {getInitials(conv.contact_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold truncate">{conv.contact_name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                              {format(new Date(conv.last_time), "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">{conv.last_message || "—"}</p>
                            {conv.unread_count > 0 && (
                              <span className="flex-shrink-0 ml-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </ScrollArea>
              </div>

              {/* Right: Chat panel */}
              <div className="flex-1 flex flex-col">
                {activeConversation ? (
                  <>
                    {/* Chat header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold", avatarColor(activeConversation.contact_name))}>
                        {getInitials(activeConversation.contact_name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{activeConversation.contact_name}</p>
                        <p className="text-xs text-primary">Online</p>
                      </div>
                    </div>

                    {/* Chat messages */}
                    <ScrollArea className="flex-1 px-4 py-3">
                      <div className="space-y-2">
                        {activeConversation.messages.map((m) => {
                          const isOutbound = m.direction === "outbound";
                          return (
                            <div
                              key={m.id}
                              className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
                            >
                              <div
                                className={cn(
                                  "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                                  isOutbound
                                    ? "bg-[#005c4b] text-white rounded-tr-sm"
                                    : "bg-secondary text-foreground rounded-tl-sm"
                                )}
                              >
                                <p className="whitespace-pre-wrap break-words">{m.content || "—"}</p>
                                <div className={cn("flex items-center gap-1 mt-1", isOutbound ? "justify-end" : "justify-start")}>
                                  <span className={cn("text-[10px]", isOutbound ? "text-white/60" : "text-muted-foreground")}>
                                    {format(new Date(m.sent_at || m.created_at), "HH:mm")}
                                  </span>
                                  {isOutbound && (
                                    (() => {
                                      const st = STATUS_ICONS[m.status] || STATUS_ICONS.pending;
                                      const StIcon = st.icon;
                                      return <StIcon className="h-3 w-3 text-white/60" />;
                                    })()
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Chat input */}
                    <div className="p-3 border-t border-border/50 bg-card">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Digite uma mensagem..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                          className="flex-1 text-sm"
                        />
                        <Button
                          size="icon"
                          onClick={handleSendChat}
                          disabled={sendingChat || !chatInput.trim()}
                          className="flex-shrink-0"
                        >
                          {sendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Selecione uma conversa para começar</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ── Templates Tab ── */}
        <TabsContent value="templates">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="gap-2 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Novo Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card className="border-border/50 p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum template criado.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <Card key={t.id} className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-display truncate">{t.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{t.content}</p>
                    {t.variables && t.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {t.variables.map((v) => (
                          <Badge key={v} variant="outline" className="text-xs">{`{{${v}}}`}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs flex-1 gap-1" onClick={() => setShowPreview(t)}>
                        <Eye className="h-3 w-3" /> Preview
                      </Button>
                      <Button size="sm" className="text-xs flex-1 gap-1" onClick={() => setShowSend(t)}>
                        <Send className="h-3 w-3" /> Enviar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Template Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Template</DialogTitle>
            <DialogDescription>Crie um template de mensagem WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input placeholder="ex: boas_vindas" value={newTemplate.name} onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate((p) => ({ ...p, category: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="utility">Utilidade</SelectItem>
                  <SelectItem value="authentication">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conteúdo</Label>
              <Textarea placeholder="Olá {{nome}}, obrigado pela compra!" value={newTemplate.content} onChange={(e) => setNewTemplate((p) => ({ ...p, content: e.target.value }))} rows={4} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Variáveis (separadas por vírgula)</Label>
              <Input placeholder="nome, produto, valor" value={newTemplate.variables} onChange={(e) => setNewTemplate((p) => ({ ...p, variables: e.target.value }))} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateTemplate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={!!showPreview} onOpenChange={() => setShowPreview(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Preview: {showPreview?.name}</DialogTitle>
            <DialogDescription>Visualização do template.</DialogDescription>
          </DialogHeader>
          <div className="bg-[#0b141a] rounded-xl p-4 my-2">
            <div className="bg-[#005c4b] text-white rounded-xl rounded-tr-none px-3 py-2 text-sm max-w-[80%] ml-auto whitespace-pre-wrap">
              {showPreview && renderPreviewContent(showPreview)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(null)}>Fechar</Button>
            <Button onClick={() => { setShowSend(showPreview); setShowPreview(null); }} className="gap-1">
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Dialog ── */}
      <Dialog open={!!showSend} onOpenChange={() => setShowSend(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Enviar: {showSend?.name}</DialogTitle>
            <DialogDescription>Selecione o contato para enviar a mensagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Contato</Label>
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecionar contato" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.whatsapp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Mensagem:</p>
              <p className="text-sm">{showSend?.content}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSend(null)}>Cancelar</Button>
            <Button onClick={handleSendManual} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
