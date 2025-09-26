import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/app/example/ThemedText';
import { ThemedView } from '@/app/example/ThemedView';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Tela não encontrada!' }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">Tela não Encontrada</ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText type="link">Voltar</ThemedText>
        </Link>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
