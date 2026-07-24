const ECOPONTOS_POR_ID = {
  '1': 'PEV ITACORUBI',
  '2': 'PEV CAPOEIRAS',
  '3': 'PEV MORRO DAS PEDRAS',
  '4': 'PEV MONTE CRISTO (ARESP)',
  '5': 'PEV CANASVIEIRAS',
  '6': 'PEV RIO VERMELHO',
  '7': 'PEV INGLESES',
  '8': 'PEV COSTEIRA',
  '9': 'PEV COLONINHA'
};
const ECOPONTOS_VALIDOS = Object.keys(ECOPONTOS_POR_ID).map(function (id) {
  return ECOPONTOS_POR_ID[id];
});
const ABA_ERROS = '_Erros';
const CABECALHO = ['ID Registro', 'Ecoponto', 'Placa', 'Data', 'Hora',
                   'Bairro', 'Residuos', 'Hora Registro', 'Status Envio',
                   'Recebido Em'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var payloadBruto = e.postData.contents;
    var dados = JSON.parse(payloadBruto);

    // Compatibilidade com versões antigas do app, que enviavam apenas o ID
    // numérico do ecoponto e ainda não possuíam idRegistro.
    dados.ecoponto = normalizarEcoponto(dados.ecoponto);
    if (!dados.idRegistro) {
      dados.idRegistro = criarIdLegado(payloadBruto);
    }

    var camposObrigatorios = ['ecoponto', 'placa', 'data', 'hora'];
    for (var i = 0; i < camposObrigatorios.length; i++) {
      if (!dados[camposObrigatorios[i]]) {
        registrarErro('Campo obrigatório ausente: ' + camposObrigatorios[i], e.postData.contents);
        return ContentService.createTextOutput('OK');
      }
    }

    if (ECOPONTOS_VALIDOS.indexOf(dados.ecoponto) === -1) {
      registrarErro('Ecoponto inválido: ' + dados.ecoponto, e.postData.contents);
      return ContentService.createTextOutput('OK');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName(dados.ecoponto);
    if (!aba) {
      aba = ss.insertSheet(dados.ecoponto);
      aba.appendRow(CABECALHO);
      aba.setFrozenRows(1);
    }

    var colunaId = aba.getRange(1, 1, aba.getLastRow(), 1).getValues();
    for (var j = 0; j < colunaId.length; j++) {
      if (colunaId[j][0] === dados.idRegistro) {
        return ContentService.createTextOutput('OK');
      }
    }

    var recebidoEm = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var linha = [
      dados.idRegistro,
      dados.ecoponto,
      dados.placa,
      dados.data,
      dados.hora,
      dados.bairro || '',
      dados.residuos || '',
      dados.horaRegistro || '',
      dados.status || 'Pendente',
      recebidoEm
    ];
    aba.appendRow(linha);

    return ContentService.createTextOutput('OK');

  } catch (err) {
    registrarErro(err.toString(), e.postData.contents);
    return ContentService.createTextOutput('OK');
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput('GAS Ecopontos ativo');
}

function normalizarEcoponto(ecoponto) {
  var valor = String(ecoponto || '').trim();
  if (ECOPONTOS_POR_ID[valor]) {
    return ECOPONTOS_POR_ID[valor];
  }
  return ECOPONTOS_VALIDOS.indexOf(valor) !== -1 ? valor : '';
}

function criarIdLegado(payloadBruto) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    payloadBruto,
    Utilities.Charset.UTF_8
  );
  var hexadecimal = digest.map(function (byte) {
    var valor = (byte + 256) % 256;
    return ('0' + valor.toString(16)).slice(-2);
  }).join('');
  return 'legado-' + hexadecimal.substring(0, 32);
}

function registrarErro(motivo, payloadBruto) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_ERROS);
  if (!aba) {
    aba = ss.insertSheet(ABA_ERROS);
    aba.appendRow(['Timestamp', 'Motivo', 'Payload']);
    aba.setFrozenRows(1);
  }
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  aba.appendRow([timestamp, motivo, payloadBruto]);
}
