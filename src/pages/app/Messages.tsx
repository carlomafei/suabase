import { useEffect, useState, useCallback } from "react";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
  contact_name?: string;
  contact_whatsapp?: string;
  sentiment?: string | null;
}

const STATUS_ICONS: Record<string, { icon: typeof Send; label: string; color: string }> = {
  pending: { icon: Clock, label: "Pendente", color: "text-muted-foreground" },
  sent: { icon: CheckCircle, label: "Enviada", color: "text-blue-400" },
  delivered: { icon: CheckCheck, label: "Entregue", color: "text-primary" },
  received: { icon: Reply, label: "Recebida", color: "text-amber-400" },
  read: { icon: CheckCheck, label: "Lida", color: "text-primary" },
  failed: { icon: Clock, label: "Falhou", color: "text-destructive" },
};

const Messages = () => {
  const { tenantId } = useTenant();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState<Template | null>(null);
  const [showSend, setShowSend] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", category: "marketing", variables: "" });
  const [searchMsg, setSearchMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; whatsapp: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState("");

  const fetchData = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    const [templatesRes, messagesRes, contactsRes] = await Promise.all([
      supabase.from("whatsapp_templates").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("messages").select("*, contacts(name, whatsapp)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
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

  const handleCreateTemplate = async () => {
    if (!tenantId || !newTemplate.name || !newTemplate.content) { toast.error("Preencha nome e conteúdo"); return; }
    setSaving(true);

    const vars = newTemplate.variables.split(",").map((v) => v.trim()).filter(Boolean);
    const { error } = await supabase.from("whatsapp_templates").insert({
      tenant_id: tenantId,
      name: newTemplate.name,
      content: newTemplate.content,
      category: newTemplate.category,
      variables: vars.length > 0 ? vars : null,
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
      tenant_id: tenantId,
      contact_id: selectedContact,
      content: showSend.content,
      template_id: showSend.id,
      direction: "outbound",
      channel: "whatsapp",
      status: "sent",
      sent_at: new Date().toISOString(),
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

  const filteredMessages = messages.filter((m) => {
    if (!searchMsg) return true;
    const q = searchMsg.toLowerCase();
    return m.content?.toLowerCase().includes(q) || m.contact_name?.toLowerCase().includes(q);
  });

  const renderPreviewContent = (template: Template) => {
    let content = template.content;
    (template.variables || []).forEach((v, i) => {
      content = content.replace(`{{${v}}}`, `[${v}]`);
    });
    return content;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Comunicação</h1>
        <p className="text-muted-foreground text-sm mt-1">Templates WhatsApp, envios e histórico</p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="mb-6">
          <TabsTrigger value="templates" className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs">
            <MessageCircle className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

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

        {/* ── History Tab ── */}
        <TabsContent value="history">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar mensagens..." value={searchMsg} onChange={(e) => setSearchMsg(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>

          {filteredMessages.length === 0 ? (
            <Card className="border-border/50 p-8 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma mensagem encontrada.</p>
            </Card>
          ) : (
            <Card className="border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Contato</TableHead>
                      <TableHead className="text-xs">Direção</TableHead>
                      <TableHead className="text-xs">Conteúdo</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Sentimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.map((m) => {
                      const st = STATUS_ICONS[m.status] || STATUS_ICONS.pending;
                      const StIcon = st.icon;
                      return (
                        <TableRow key={m.id} className="border-border/50">
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(m.sent_at || m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{m.contact_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={m.direction === "outbound" ? "default" : "secondary"} className="text-xs">
                              {m.direction === "outbound" ? "Enviada" : "Recebida"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{m.content || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <StIcon className={cn("h-3.5 w-3.5", st.color)} />
                              <span className={cn("text-xs", st.color)}>{st.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {m.sentiment ? (
                              <Badge variant="outline" className={cn("text-xs",
                                m.sentiment === "positive" ? "text-primary border-primary/30" :
                                m.sentiment === "negative" ? "text-destructive border-destructive/30" :
                                "text-amber-400 border-amber-400/30"
                              )}>
                                {m.sentiment === "positive" ? "Positivo" : m.sentiment === "negative" ? "Negativo" : "Neutro"}
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
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
