
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bot, ImageIcon, MessageSquare, Users } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { LogoUploaderFirebase } from "./logo-uploader-firebase";


const activityData = [
  { date: 'Lundi', conversations: 4 },
  { date: 'Mardi', conversations: 3 },
  { date: 'Mercredi', conversations: 5 },
  { date: 'Jeudi', conversations: 2 },
  { date: 'Vendredi', conversations: 6 },
  { date: 'Samedi', conversations: 1 },
  { date: 'Dimanche', conversations: 4 },
];

export function Dashboard() {
  return (
      <ScrollArea className="flex-1 py-4">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <CardTitle className="text-sm font-medium">Modèle IA</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Gemini 2.0</div>
                <p className="text-xs text-muted-foreground">Flash</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Personnalisation du Logo
                </CardTitle>
                <CardDescription>
                    Téléversez le logo de votre entreprise. Il sera visible par tous les utilisateurs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LogoUploaderFirebase />
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
  );
}
