import { Redirect, useLocalSearchParams } from 'expo-router';

// Native placeholder — the interactive social-web explorer is a web feature for
// now; native falls back to the character dossier until its own explorer pass.
export default function SocialWebNative() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/character/${id}`} />;
}
