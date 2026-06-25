import { registerDemandaActions } from "./builtin/demanda.actions";
import { registerSuiteActions } from "./builtin/suite.actions";
import { registerEcopontoActions } from "./builtin/ecoponto.actions";
import { registerEncaminhamentoActions } from "./builtin/encaminhamento.actions";
import { registerReencaminharAction } from "./builtin/reencaminhar.action";
import { registerDevolverAction } from "./builtin/devolver.action";
import { registerSolicitarAction } from "./builtin/solicitar.action";
import { registerCriarTarefaAction } from "./builtin/criar_tarefa.action";

export function initializeActions() {
  registerDemandaActions();
  registerSuiteActions();
  registerEcopontoActions();
  registerEncaminhamentoActions();
  registerReencaminharAction();
  registerDevolverAction();
  registerSolicitarAction();
  registerCriarTarefaAction();
}
