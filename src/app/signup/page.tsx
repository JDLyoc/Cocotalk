'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function SignUpPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
        toast({ variant: 'destructive', title: 'Mot de passe trop court', description: 'Le mot de passe doit contenir au moins 6 caractères.' });
        return;
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const isAdmin = email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

      // Create a document for the user in Firestore with a role
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        role: isAdmin ? 'admin' : 'user',
      });
      
      if (isAdmin) {
        // Admin user is logged in automatically and redirected to the app
        toast({
          title: 'Compte Administrateur créé!',
          description: "Vous êtes maintenant connecté.",
        });
        router.push('/');
      } else {
        // Regular user must be enabled in the console. Sign them out.
        await auth.signOut();
        toast({
          title: 'Compte créé avec succès!',
          description: "Votre compte doit être activé par un administrateur. Vous pouvez maintenant essayer de vous connecter.",
        });
        router.push('/login');
      }

    } catch (error: any) {
      console.error(error);
      let description = 'Une erreur inconnue est survenue.';
      if (error.code && error.code.includes('api-key')) {
        description = 'Clé API Firebase invalide. Veuillez vérifier la configuration dans votre fichier .env.';
      } else if (error.code === 'auth/email-already-in-use') {
        description = 'Cette adresse e-mail est déjà utilisée par un autre compte.';
      } else if (error.code === 'auth/invalid-email') {
        description = "L'adresse e-mail n'est pas valide.";
      } else if (error.code === 'auth/operation-not-allowed') {
        description = "La connexion par e-mail/mot de passe n'est pas activée. Veuillez l'activer dans la console Firebase.";
      }
      toast({ variant: 'destructive', title: 'Erreur d\'inscription', description });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Image src="/icon.svg" alt="Logo" width={48} height={48} className="mx-auto mb-4" data-ai-hint="logo" />
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
          <CardDescription>Entrez votre e-mail et un mot de passe pour commencer.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="nom@exemple.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              S'inscrire
            </Button>
            <div className="text-center text-sm">
              Déjà un compte?{' '}
              <Link href="/login" className="underline">
                Se Connecter
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
