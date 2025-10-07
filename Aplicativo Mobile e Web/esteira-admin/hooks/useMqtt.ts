import { Client, Message } from 'paho-mqtt';
import { useEffect, useState } from 'react';

type LogEntry = { time: string; value: string };

export function informacoesMqtt(topicoPadraoReceber: string = 'dados/camera', topicoPadraoEnviar: string = "dados/app") {
  const [client, setClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');
  const [estado, setEstado] = useState(0);
  const [ligarDesligarEstado, setLigarDesligarEstado] = useState('Ligar');
  const [azul, setAzul] = useState(0);
  const [vermelho, setVermelho] = useState(0);
  const [verde, setVerde] = useState(0);
  const [corndef, setCorNDef] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaMsg, setUltimaMsg] = useState('');
  const [topicoMsgReceber, setTopicoMsgReceber] = useState(topicoPadraoReceber);
  const [topicoMsgEnviar, setTopicoMsgEnviar] = useState(topicoPadraoEnviar);


  useEffect(() => {
    const clientId = 'expo_' + Math.random().toString(16).substr(2, 8);
    const mqttClient = new Client(
      'wss://f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud:8884/mqtt',
      clientId
    );

    mqttClient.connect({
      useSSL: true,
      userName: 'yago_ic',
      password: 'brokerP&x+e[5&ifZ_R}T',
      onSuccess: () => {
        mqttClient.subscribe(topicoMsgReceber);
        setClient(mqttClient);
        setLoading(false);
      },
      onFailure: err => console.error('Erro MQTT:', err),
    });

    mqttClient.onMessageArrived = (msg: Message) => {
      const p = msg.payloadString ?? '';
      const time = new Date().toLocaleString();
      setMessage(p);
      setLogs(prev => [...prev, { time, value: p }]);
      setUltimaMsg(p);

      if (p === 'Cor:Vermelho') setVermelho(v => v + 1);
      else if (p === 'Cor:Verde') setVerde(v => v + 1);
      else if (p === 'Cor:Azul') setAzul(v => v + 1);
      else if (p === 'Cor:CorNDef') setCorNDef(v => v + 1);
    };

    return () => mqttClient.disconnect();
  }, [topicoMsgReceber]);

  const alterarEstadoEsteira = () => {
    if (!client) return;

    setLigarDesligarEstado('Aguarde...');

    const novaMensagem = estado === 1 ? '0' : '1';
    const novoEstado = estado === 1 ? 0 : 1;
    const novoTextoBotao = estado === 1 ? 'Ligar' : 'Desligar';

    const msg = new Message(novaMensagem);
    msg.destinationName = topicoMsgEnviar;
    client.send(msg);

    setTimeout(() => {
      setEstado(novoEstado);
      setLigarDesligarEstado(topicoMsgEnviar);
    }, 500);
  };

  const ngrokRefresh = () => {
    const msg = new Message("Refresh");
    msg.destinationName = topicoMsgEnviar;
    client.send(msg);
  };

  const arrayBufferToBase64 = (buffer: Uint8Array) => {
    let binary = '';
    const bytes = buffer;
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  return {
    loading,
    estado,
    ligarDesligarEstado,
    azul,
    vermelho,
    verde,
    corndef,
    logs,
    ultimaMsg,
    alterarEstadoEsteira,
    setTopicoMsgEnviar,
    setTopicoMsgReceber,
    ngrokRefresh
  };
}
