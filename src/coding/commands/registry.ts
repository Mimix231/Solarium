export interface GlitchCommandContext {
  source?: "palette" | "keyboard" | "menu" | "dona" | "api";
}

export interface GlitchCommand {
  id: string;
  title: string;
  category: string;
  description?: string;
  keybinding?: string;
  when?: () => boolean;
  run: (context: GlitchCommandContext) => void | Promise<void>;
}

class CommandRegistry {
  private commands = new Map<string, GlitchCommand>();

  register(command: GlitchCommand): () => void {
    if (this.commands.has(command.id)) throw new Error(`Glitch command already registered: ${command.id}`);
    this.commands.set(command.id, command);
    return () => this.commands.delete(command.id);
  }

  upsert(command: GlitchCommand): void { this.commands.set(command.id, command); }

  get(id: string): GlitchCommand | undefined { return this.commands.get(id); }

  list(): GlitchCommand[] {
    return [...this.commands.values()]
      .filter((command) => command.when?.() !== false)
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  }

  async execute(id: string, context: GlitchCommandContext = {}): Promise<void> {
    const command = this.commands.get(id);
    if (!command) throw new Error(`Unknown Glitch command: ${id}`);
    if (command.when?.() === false) return;
    await command.run(context);
  }

  search(query: string): GlitchCommand[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.list().map((command) => {
      const haystack = `${command.category} ${command.title} ${command.id} ${command.description ?? ""}`.toLowerCase();
      const score = terms.reduce((total, term) => total +
        (command.title.toLowerCase().startsWith(term) ? 8 : 0) +
        (command.title.toLowerCase().includes(term) ? 4 : 0) +
        (command.id.toLowerCase().includes(term) ? 2 : 0) +
        (haystack.includes(term) ? 1 : 0), 0);
      return { command, score };
    }).filter((entry) => !terms.length || entry.score > 0)
      .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
      .map((entry) => entry.command);
  }
}

export const commandRegistry = new CommandRegistry();
