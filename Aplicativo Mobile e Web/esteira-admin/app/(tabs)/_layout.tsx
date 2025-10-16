import { IconSymbol } from '@/components/ui/IconSymbol';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fff',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#ccc',
          elevation: 0, // Remove sombra Android
          shadowOpacity: 0, // Remove sombra iOS
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '500',
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <IconSymbol size={16} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sobre"
        options={{
          title: 'Sobre Nós',
          tabBarIcon: ({ color }) => <IconSymbol size={16} name="paperplane.fill" color={color} />,
        }}
      />
      {/* <Tabs.Screen
        name="camera"
        options={{
          title: 'Câmera',
          tabBarIcon: ({ color }) => <IconSymbol size={16} name="camera.fill" color={color} />,
          //headerRight: () => <RefreshNgrok></RefreshNgrok>,
        }}
      /> */}
      <Tabs.Screen
        name="editar_foto"
        options={{
          title: 'Fotos',
          tabBarIcon: ({ color }) => <IconSymbol size={16} name="square.and.pencil" color={color} />,
        }}
      />

      
    </Tabs>
    
  );
}
