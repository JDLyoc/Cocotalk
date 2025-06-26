
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bot, ImageIcon, MessageSquare, Users } from "lucide-react";
import { LogoUploaderFirebase } from "./logo-uploader-firebase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useModel, AVAILABLE_MODELS, type AvailableModel } from "@/contexts/model-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const activityData = [
  { date: 'Lundi', conversations: 4 },
  { date: 'Mardi', conversations: 3 },
  { date: 'Mercredi', conversations: 5 },
  { date: 'Jeudi', conversations: 2 },
  { date: 'Vendredi', conversations: 6 },
  { date: 'Samedi', conversations: 1 },
  { date: 'Dimanche', conversations: 4 },
];

const modelDisplayNames: Record<AvailableModel, string> = {
    'googleai/gemini-2.0-flash': 'Gemini 2.0 Flash',
    'googleai/gemini-1.5-flash': 'Gemini 1.5 Flash',
    'googleai/gemini-1.5-pro': 'Gemini 1.5 Pro',
};

export function Dashboard() {
  const { model, setModel } = useModel();

  return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversations totales</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">125</div>
              <p className="text-xs text-muted-foreground">+10% depuis le mois dernier</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs actifs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">+2 depuis hier</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Modèle IA Actif</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Select value={model} onValueChange={(value) => setModel(value as AvailableModel)}>
                    <SelectTrigger className="text-2xl font-bold p-0 h-auto border-none focus:ring-0 shadow-none">
                        <SelectValue placeholder="Choisir un modèle" />
                    </SelectTrigger>
                    <SelectContent>
                        {AVAILABLE_MODELS.map((m) => (
                            <SelectItem key={m} value={m}>
                                {modelDisplayNames[m]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">S'applique à toute l'app.</p>
            </CardContent>
          </Card>
          <Dialog>
            <DialogTrigger asChild>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Logo d'entreprise</CardTitle>
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Télécharger</div>
                  <p className="text-xs text-muted-foreground">Cliquez pour modifier</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                  <DialogTitle>Personnalisation du Logo</DialogTitle>
                  <DialogDescription>
                      Téléversez le logo de votre entreprise. Il sera visible par tous les utilisateurs.
                  </DialogDescription>
              </DialogHeader>
              <div className="pt-4">
                <LogoUploaderFirebase />
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Activité hebdomadaire</CardTitle>
              <CardDescription>Nombre de conversations par jour.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                              background: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                          }}
                        />
                        <Legend wrapperStyle={{fontSize: "12px"}}/>
                        <Bar dataKey="conversations" name="Conversations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
