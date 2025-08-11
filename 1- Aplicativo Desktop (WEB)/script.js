//BROKER MQTT //

const broker = "wss://f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud:8884/mqtt"; // WebSocket seguro
const options = {
    username: "yago_ic",
    password: "brokerP&x+e[5&ifZ_R}T"
};

const topic_esp_site = "esp32/placa_esp"
const topic_site_esp = "esp32/site"
const client = mqtt.connect(broker, options);

// DESLIGAR LIGA DESLIGA ATE CONECTAR NO BROKER

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('cCB1').disabled = true;  
});

// AO CONECTAR NO HIVEMQ

client.on("connect", () => {
    console.log("Conectado ao HiveMQ");
    document.getElementById('cCB1').disabled = false;
    document.getElementById("status_esteira").classList.add("text-success");
    document.getElementById("status_esteira").innerText = "ONLINE";
    client.subscribe(topic_esp_site);
});

// AO RECEBER MENSAGEM

client.on("message", (t, message) => { // Recebe mensagem do arduino atraves do broker
    red = document.getElementById('qtd_vermelho');
    blue = document.getElementById('qtd_azul');
    green = document.getElementById('qtd_verde');
    outro = document.getElementById('qtd_outro');

    if (t === topic_esp_site) {
        document.getElementById("mensagem").innerText = "Mensagem enviada do ESP-32: " + message.toString();
    
        if (message == 5) {
            console.log("Erro de Reconhecimento de Cor!");
            outro.innerText = parseInt(outro.innerText) + 1;
        } 
        else if (message == 4) {
            red.innerText = parseInt(red.innerText) + 1;
            
        } 
        else if (message == 3) {
            blue.innerText = parseInt(blue.innerText) + 1;
        } 
        else if (message == 2) {
            green.innerText = parseInt(green.innerText) + 1;
            
        }
    }
});

// FUNCAO QUE ENVIA MENSAGEM COM INPUT //

function enviarMensagem() {
    const mensagem = document.getElementById("inputEnviar").value;
    if (mensagem.trim() !== "") {
        client.subscribe(topic_site_esp);
        client.publish(topic_site_esp, mensagem);
        document.getElementById("inputEnviar").value = "";
        client.subscribe(topic_esp_site);
    }
}


//FUNCAO LIGA E DESLIGA //

function ligaDesliga() {
    const checkBox = document.getElementById("cCB1"); // Checkbox
    const statusText = document.getElementById("checkBoxLigaDesliga"); // Texto

    // Verifica o estado do checkbox
    if (checkBox.checked) {
        console.log("ligar");
        client.publish(topic_site_esp, "1"); 
        statusText.innerText = "Desligar"; 
    } else {
        console.log("desligar");
        client.publish(topic_site_esp, "0"); 
        statusText.innerText = "Ligar"; 
    }
}

// function sleep(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// sleep(2000)
//     .then(() => {
//         document.getElementById("status_esteira").innerText = ".";
//     })
//     .then(() => sleep(300))
//     .then(() => {
//         document.getElementById("status_esteira").innerText = ". .";
//     })
//     .then(() => sleep(300))
//     .then(() => {
//         document.getElementById("status_esteira").innerText = ". . .";
//     })
//     .then(() => sleep(300))
//     .then(() => {
//         document.getElementById("status_esteira").innerText = ".";
//     })
//     .then(() => sleep(300))
//     .then(() => {
//         document.getElementById("status_esteira").innerText = ". .";
//     })
//     .then(() => sleep(300))
//     .then(() => {
//         document.getElementById("status_esteira").innerText = ". . .";
//     });