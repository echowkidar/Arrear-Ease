"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Edit,
  Save,
  X,
  Users,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Calendar,
  Zap,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { PlanType } from "@/context/subscription-context";

export const dynamic = "force-dynamic";

type AppUser = {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  createdAt: Timestamp | Date;
  lastLogin?: Timestamp | Date;
  allowBasicPayAutoFill?: boolean;
  subscriptionPlan?: PlanType;
  credits?: number;
  planExpiresAt?: string | Timestamp | Date;
};

type PaymentTransaction = {
  id: string;
  planId: string;
  planName: string;
  amount: number;
  utr: string;
  date: string;
  status: string;
  userEmail?: string;
  createdAt?: any;
};

const editUserSchema = z.object({
  displayName: z.string().min(1, "Name is required."),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

const ProtectedUsersPage = () => {
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [payments, setPayments] = React.useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editingUser, setEditingUser] = React.useState<AppUser | null>(null);
  const [planModalUser, setPlanModalUser] = React.useState<AppUser | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<PlanType>("pro");
  const [customCredits, setCustomCredits] = React.useState<number>(10);
  const [planExpiryDays, setPlanExpiryDays] = React.useState<number>(365);
  const [isSavingPlan, setIsSavingPlan] = React.useState(false);

  const { toast } = useToast();
  const { user, authStatus } = useAuth();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
  });

  const fetchUsers = React.useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db!, "users"));
      const usersData = usersSnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as AppUser[];

      usersData.sort((a, b) => {
        const aDate =
          a.lastLogin instanceof Timestamp
            ? a.lastLogin.toMillis()
            : a.lastLogin
            ? new Date(a.lastLogin).getTime()
            : 0;
        const bDate =
          b.lastLogin instanceof Timestamp
            ? b.lastLogin.toMillis()
            : b.lastLogin
            ? new Date(b.lastLogin).getTime()
            : 0;

        if (aDate !== bDate) {
          return bDate - aDate;
        }

        const aCreated =
          a.createdAt instanceof Timestamp
            ? a.createdAt.toMillis()
            : new Date(a.createdAt).getTime();
        const bCreated =
          b.createdAt instanceof Timestamp
            ? b.createdAt.toMillis()
            : new Date(b.createdAt).getTime();
        return bCreated - aCreated;
      });

      setUsers(usersData);

      // Also fetch payment transactions
      try {
        const txSnapshot = await getDocs(collection(db!, "payment_transactions"));
        const txData = txSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PaymentTransaction[];
        txData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPayments(txData);
      } catch (txErr) {
        console.warn("Payment transactions fetch note:", txErr);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        variant: "destructive",
        title: "Failed to load users",
        description: "Check console for details.",
      });
    }
    setIsLoading(false);
  }, [toast, user]);

  React.useEffect(() => {
    if (authStatus === "authenticated" && user?.email === "amulivealigarh@gmail.com") {
      fetchUsers();
    }
  }, [fetchUsers, user, authStatus]);

  const handleEdit = (user: AppUser) => {
    setEditingUser(user);
    form.reset({ displayName: user.displayName });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    form.reset();
  };

  const onUpdateUser = async (data: EditUserFormValues) => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      const userDocRef = doc(db!, "users", editingUser.uid);
      await updateDoc(userDocRef, { displayName: data.displayName });
      toast({ title: "User updated successfully" });
      cancelEdit();
      await fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ variant: "destructive", title: "Failed to update user" });
    }
    setIsLoading(false);
  };

  const handleOpenPlanModal = (targetUser: AppUser) => {
    setPlanModalUser(targetUser);
    setSelectedPlan(targetUser.subscriptionPlan || "pro");
    setCustomCredits(
      targetUser.credits !== undefined
        ? targetUser.credits
        : targetUser.subscriptionPlan === "unlimited"
        ? 999
        : 10
    );
    setPlanExpiryDays(365);
  };

  const handleSaveUserPlan = async () => {
    if (!planModalUser) return;
    setIsSavingPlan(true);
    try {
      const userDocRef = doc(db!, "users", planModalUser.uid);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + Number(planExpiryDays));

      const updatePayload: any = {
        subscriptionPlan: selectedPlan,
        credits: selectedPlan === "unlimited" ? -1 : Number(customCredits),
        planExpiresAt: expiryDate.toISOString(),
      };

      await updateDoc(userDocRef, updatePayload);

      toast({
        title: "Plan & Credits Assigned!",
        description: `Successfully updated ${planModalUser.displayName || planModalUser.email} to ${selectedPlan.toUpperCase()} with ${customCredits} credits.`,
      });

      setPlanModalUser(null);
      await fetchUsers();
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast({
        variant: "destructive",
        title: "Failed to assign plan",
        description: error.message || "Firestore update failed.",
      });
    } finally {
      setIsSavingPlan(false);
    }
  };

  const toggleBasicPayAutoFill = async (uid: string, currentVal: boolean | undefined) => {
    setIsLoading(true);
    const newVal = !currentVal;
    try {
      const userDocRef = doc(db!, "users", uid);
      await updateDoc(userDocRef, { allowBasicPayAutoFill: newVal });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, allowBasicPayAutoFill: newVal } : u))
      );
      toast({
        title: "Updated Setting",
        description: `Auto-fill basic pay is now ${newVal ? "enabled" : "disabled"} for this user.`,
      });
    } catch (error) {
      console.error("Error toggling auto-fill:", error);
      toast({ variant: "destructive", title: "Failed to update setting" });
    }
    setIsLoading(false);
  };

  const deleteUserAndStatements = async (uid: string) => {
    setIsLoading(true);
    try {
      const batch = writeBatch(db!);
      const userDocRef = doc(db!, "users", uid);
      batch.delete(userDocRef);

      const statementsQuery = query(collection(db!, "savedStatements"), where("userId", "==", uid));
      const statementsSnapshot = await getDocs(statementsQuery);
      statementsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      toast({
        title: "User deleted",
        description: "User profile and all associated arrear statements removed.",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({ variant: "destructive", title: "Failed to delete user" });
    }
    setIsLoading(false);
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return isNaN(d.getTime()) ? "N/A" : format(d, "dd MMM yyyy, HH:mm");
  };

  const formatExpiry = (date: any) => {
    if (!date) return "N/A";
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    const isExpired = d < new Date();
    return (
      <span className={isExpired ? "text-red-500 font-semibold" : "text-emerald-600 font-semibold"}>
        {format(d, "dd MMM yyyy")} {isExpired ? "(Expired)" : ""}
      </span>
    );
  };

  return (
    <main className="container mx-auto px-4 py-8 md:py-12 space-y-6">
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary text-center mt-4">
          User & Subscription Management
        </h1>
        <p className="text-muted-foreground mt-2 text-lg text-center">
          Manage user accounts, assign AI subscription plans, track credits, and review UPI payments.
        </p>
      </header>

      {/* Plan Assignment Dialog for Admin */}
      <Dialog open={!!planModalUser} onOpenChange={(open) => !open && setPlanModalUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold">
              <Sparkles className="h-5 w-5 text-amber-500" /> Assign AI Plan & Credits
            </DialogTitle>
            <DialogDescription>
              Assign or modify plan, verification credits, and expiry for{" "}
              <strong>{planModalUser?.displayName || planModalUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Subscription Plan</Label>
              <Select value={selectedPlan} onValueChange={(val: PlanType) => setSelectedPlan(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free Plan (0 Credits)</SelectItem>
                  <SelectItem value="single">Single Sheet Audit (1 Credit)</SelectItem>
                  <SelectItem value="pro">Professional Pack (10 Credits)</SelectItem>
                  <SelectItem value="unlimited">Annual Unlimited (Unlimited Audits)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedPlan !== "unlimited" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">AI Credits Balance</Label>
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  value={customCredits}
                  onChange={(e) => setCustomCredits(parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Plan Validity (Days from Today)</Label>
              <Input
                type="number"
                min="1"
                max="3650"
                value={planExpiryDays}
                onChange={(e) => setPlanExpiryDays(parseInt(e.target.value) || 365)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPlanModalUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUserPlan} disabled={isSavingPlan} className="bg-primary">
              {isSavingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Plan & Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs: Users List & Payment Transactions */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="users" className="font-semibold">
            <Users className="h-4 w-4 mr-2" /> Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="font-semibold">
            <CreditCard className="h-4 w-4 mr-2" /> UPI Payments ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ALL USERS */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Users className="h-5 w-5 text-primary" /> Registered Users & Subscription Plans
              </CardTitle>
              <CardDescription>
                View all registered accounts, their active plans, AI verification credits, and expiration dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User / Email</TableHead>
                        <TableHead>Active Plan</TableHead>
                        <TableHead className="text-center">Credits</TableHead>
                        <TableHead>Plan Expiry</TableHead>
                        <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                        <TableHead className="text-center">Auto Basic Pay</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => {
                        const isUUnlimited = u.subscriptionPlan === "unlimited";
                        return (
                          <TableRow key={u.uid} className="hover:bg-muted/30">
                            <TableCell>
                              {editingUser?.uid === u.uid ? (
                                <form onSubmit={form.handleSubmit(onUpdateUser)} className="flex items-center gap-2">
                                  <Input {...form.register("displayName")} className="h-8" />
                                  <Button size="icon" className="h-8 w-8" type="submit" disabled={isLoading}>
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </form>
                              ) : (
                                <div>
                                  <strong className="text-foreground block text-sm">{u.displayName || "User"}</strong>
                                  <span className="text-xs text-muted-foreground">{u.email}</span>
                                </div>
                              )}
                            </TableCell>

                            {/* Plan Badge */}
                            <TableCell>
                              {isUUnlimited ? (
                                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[11px] font-black shadow-sm">
                                  👑 UNLIMITED
                                </Badge>
                              ) : u.subscriptionPlan === "pro" ? (
                                <Badge className="bg-primary text-primary-foreground text-[11px] font-bold">
                                  ⭐ PRO
                                </Badge>
                              ) : u.subscriptionPlan === "single" ? (
                                <Badge variant="secondary" className="text-[11px] font-semibold">
                                  ⚡ SINGLE
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                  Free
                                </Badge>
                              )}
                            </TableCell>

                            {/* Credits count */}
                            <TableCell className="text-center">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {isUUnlimited ? "∞" : u.credits !== undefined ? u.credits : 0}
                              </span>
                            </TableCell>

                            {/* Plan Expiry */}
                            <TableCell className="text-xs font-mono">
                              {formatExpiry(u.planExpiresAt)}
                            </TableCell>

                            {/* Last Login */}
                            <TableCell className="text-xs hidden lg:table-cell text-muted-foreground">
                              {formatDate(u.lastLogin)}
                            </TableCell>

                            {/* Auto Basic Pay Switch */}
                            <TableCell className="text-center">
                              <Switch
                                checked={!!u.allowBasicPayAutoFill}
                                onCheckedChange={() => toggleBasicPayAutoFill(u.uid, u.allowBasicPayAutoFill)}
                                disabled={isLoading || u.email === "amulivealigarh@gmail.com"}
                              />
                            </TableCell>

                            {/* Action Buttons */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenPlanModal(u)}
                                  className="h-8 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                                  title="Assign / Modify Subscription Plan"
                                >
                                  <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
                                  Plan
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(u)}
                                  className="h-8 w-8 p-0"
                                  disabled={isLoading || !!editingUser}
                                  title="Edit Name"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-8 w-8 p-0"
                                      disabled={isLoading || !!editingUser || u.email === "amulivealigarh@gmail.com"}
                                      title="Delete User"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the user's profile and all their saved arrear
                                        statements. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteUserAndStatements(u.uid)}>
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: UPI PAYMENT TRANSACTIONS */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <CreditCard className="h-5 w-5 text-emerald-600" /> UPI Payment Requests & UTR Verification Log
              </CardTitle>
              <CardDescription>
                All payment transactions submitted by users with 12-digit UTR references and plan activation details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No payment transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Plan Purchased</TableHead>
                        <TableHead>Amount (Rs.)</TableHead>
                        <TableHead>12-Digit UTR / Reference</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-mono">
                            {format(new Date(p.date), "dd MMM yyyy, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs">
                              {p.planName}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-foreground">
                            Rs. {p.amount}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {p.utr}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-emerald-600 text-white text-[11px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default function UsersPage() {
  const { authStatus, loading, user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;

    if (authStatus === "unauthenticated") {
      router.push("/");
    } else if (authStatus === "authenticated" && user?.email !== "amulivealigarh@gmail.com") {
      router.push("/");
    }
  }, [authStatus, user, router, loading]);

  if (loading || authStatus !== "authenticated" || user?.email !== "amulivealigarh@gmail.com") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <ProtectedUsersPage />;
}
