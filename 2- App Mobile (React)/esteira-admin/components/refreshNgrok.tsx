import { informacoesMqtt } from '@/hooks/useMqtt';
import { Button } from 'react-native';

 export default function RefreshNgrok({}) {
    const { ultimaMsg, ngrokRefresh } = informacoesMqtt("ngrok/ip","ngrok/refresh");  
    return <Button title="Atualizar IP - Ngrok" onPress={ngrokRefresh}/>;
 }
 
