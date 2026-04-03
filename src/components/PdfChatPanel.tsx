import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Message = { id: string; role: "user" | "assistant"; content: string };

type ChatFunctionError = { message?: string };

const PdfChatPanel = ({
  articleId,
  articleTitle,
}: {
  articleId: string;
  articleTitle: string;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCounterRef = useRef(0);

  const createMessage = (role: Message["role"], content: string): Message => ({
    id: `msg-${Date.now()}-${messageCounterRef.current++}`,
    role,
    content,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = createMessage("user", input);
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-with-pdf", {
        body: { messages: newMsgs, articleId, articleTitle },
      });
      if (error) throw error;
      setMessages((prev) => [...prev, createMessage("assistant", data?.reply || "No response")]);
    } catch (error) {
      const message = (error as ChatFunctionError)?.message || "Unknown error";
      setMessages((prev) => [...prev, createMessage("assistant", `Error: ${message}`)]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[300px]">
      <div className="px-3 py-2 border-b text-sm font-medium text-muted-foreground">Chat with Paper</div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4">Ask questions about "{articleTitle}"</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`text-sm p-2 rounded-lg max-w-[85%] ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Thinking...</div>}
      </div>
      <div className="p-2 border-t flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about this paper..." className="text-sm" />
        <Button size="icon" onClick={send} disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
};

export default PdfChatPanel;
