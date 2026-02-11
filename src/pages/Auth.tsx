import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp, signIn } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Zap, ArrowRight } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup") {
      const { error } = await signUp(email, password, fullName, businessName);
      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        navigate("/dashboard");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md text-primary-foreground"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Zap className="h-7 w-7" />
            </div>
            <span className="text-2xl font-display font-bold">SmartBiz AI</span>
          </div>
          <h1 className="text-4xl font-display font-bold mb-4 leading-tight">
            Automate your sales.<br />Grow your business.
          </h1>
          <p className="text-primary-foreground/70 text-lg">
            AI-powered customer management, WhatsApp automation, and demand prediction — all in one platform.
          </p>
        </motion.div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">SmartBiz AI</span>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Sign in to your dashboard"
                  : "Start your free trial — no credit card required"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {mode === "signup" && (
                    <motion.div
                      key="signup-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name</Label>
                        <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="My Awesome Store" required />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>

                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>Don't have an account?{" "}
                    <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">Sign up</button>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">Sign in</button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
