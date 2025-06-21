import readline from "readline";
import { HumanMessage } from "@langchain/core/messages";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default function askQuestion(workflow: any) {
  let messages: any[] = [];

  function prompt() {
    rl.question("Usuário: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      // Adiciona a mensagem do usuário ao histórico
      messages.push(new HumanMessage(input));

      // Invoca o workflow com o histórico de mensagens
      const state = await workflow.invoke({ messages });

      // Atualiza o histórico com todas as mensagens retornadas (mantém contexto)
      messages = state.messages;
      console.log("🤖:", state.messages[state.messages.length - 1].content);

      prompt();
    });
  }

  prompt();
}
