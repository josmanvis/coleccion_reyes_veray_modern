import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    // Call the local antigravity CLI to answer the prompt.
    // If agy is not in your PATH, you may need to specify the absolute path.
    // For example: const agyPath = "/opt/homebrew/bin/agy";
    const agyPath = process.env.AGY_PATH || "agy";
    
    // We escape the prompt for bash to prevent injection
    const context = `SYSTEM CONTEXT: You are the assistant for the OORC application. You have full read access to the OORC inventory data located in the SQLite database at ./data/inventory.db. Use tools like sqlite3 to query this database if the user asks about the inventory or artworks. \n\nUSER QUESTION: `;
    const fullPrompt = context + prompt;
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
    
    const { stdout, stderr } = await execAsync(`${agyPath} prompt '${escapedPrompt}'`);
    
    return NextResponse.json({ reply: stdout.trim() || stderr.trim() });
  } catch (error: unknown) {
    console.error("Ocho execution error:", error);
    
    // Fallback message if agy is not installed or available
    if (error && typeof error === "object" && "code" in error && error.code === 127) {
      return NextResponse.json({ 
        error: "Ocho (Antigravity CLI) no está instalado o no se encuentra en el PATH. Por favor, instala el cliente local." 
      });
    }

    return NextResponse.json({ error: "Error interno al contactar a Ocho." }, { status: 500 });
  }
}
