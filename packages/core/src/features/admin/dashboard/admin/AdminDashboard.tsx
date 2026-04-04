"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { client, useSession } from "@/features/auth/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
	Loader2,
	Plus,
	Trash,
	RefreshCw,
	UserCircle,
	Calendar as CalendarIcon,
	ShieldCheck,
	KeyRound,
	ListChecks,
	SquareChevronLeft,
	SquareChevronRight,
	UserMinus,
	Pencil,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// Add simple toast helpers used throughout this file
const toggleSuccessToast = (message: string) => toast.success(message);
const toggleErrorToast = (message: string) => toast.error(message);

// Query params state type
type UsersQuery = {
	searchValue?: string;
	searchField?: "email" | "name";
	sortBy?: string;
	sortDirection?: "asc" | "desc";
	limit?: number;
	offset?: number;
};

type User = {
	id: string;
	email: string;
	name: string;
	role:
		| "owner"
		| "developer"
		| "admin"
		| "mod"
		| "trusted"
		| "creator"
		| "user"
		| string;
	banned?: boolean;
};

type SessionsResult = {
	sessions: Array<{
		sessionToken: string;
		createdAt?: string | Date;
		expires?: string | Date;
	}>;
};

type UsersResult = {
	users: User[];
	total: number;
	limit?: number;
	offset?: number;
};

export default function AdminDashboard() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const session = useSession();

	// Create user dialog
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [newUser, setNewUser] = useState({
		email: "",
		password: "",
		name: "",
		role: "user" as const,
	});

	// Ban dialog
	const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
	const [banForm, setBanForm] = useState({
		userId: "",
		reason: "",
		expirationDate: undefined as Date | undefined,
	});

	// Set password dialog
	const [pwdDialogFor, setPwdDialogFor] = useState<{
		userId: string;
		email: string;
	} | null>(null);
	const [newPassword, setNewPassword] = useState("");

	// Sessions dialog
	const [sessionsFor, setSessionsFor] = useState<{
		userId: string;
		email: string;
	} | null>(null);

	// Rename dialog
	const [renameFor, setRenameFor] = useState<{
		userId: string;
		email: string;
		name: string;
	} | null>(null);
	const [renameName, setRenameName] = useState("");

	const [isLoading, setIsLoading] = useState<string | undefined>();

	// List users query controls
	const [qParams, setQParams] = useState<UsersQuery>({
		searchValue: "",
		searchField: "email",
		sortBy: "createdAt",
		sortDirection: "desc",
		limit: 10,
		offset: 0,
	});

	const { data: usersResult, isLoading: isUsersLoading } = useQuery({
		queryKey: ["users", qParams],
		queryFn: async (): Promise<UsersResult> => {
			const res = await client.admin.listUsers(
				{
					query: {
						searchValue: qParams.searchValue || undefined,
						searchField: qParams.searchField,
						limit: qParams.limit,
						offset: qParams.offset,
						sortBy: qParams.sortBy,
						sortDirection: qParams.sortDirection,
					},
				},
				{ throw: true },
			);
			return res as any as UsersResult;
		},
	});
	const users: User[] = usersResult?.users || [];
	const total = usersResult?.total || 0;
	const limit = qParams.limit || 10;
	const offset = qParams.offset || 0;
	const hasPrev = offset > 0;
	const hasNext = offset + limit < total;

	const resetAndRefetch = () => {
		queryClient.invalidateQueries({ queryKey: ["users"] });
	};

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading("create");
		try {
			await client.admin.createUser({
				email: newUser.email,
				password: newUser.password,
				name: newUser.name,
				role: newUser.role,
			});
			toggleSuccessToast("User created successfully");
			setNewUser({ email: "", password: "", name: "", role: "user" });
			setIsDialogOpen(false);
			resetAndRefetch();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to create user");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleDeleteUser = async (id: string) => {
		setIsLoading(`delete-${id}`);
		try {
			await client.admin.removeUser({ userId: id });
			toggleSuccessToast("User deleted successfully");
			resetAndRefetch();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to delete user");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleRevokeSessions = async (id: string) => {
		setIsLoading(`revoke-${id}`);
		try {
			await client.admin.revokeUserSessions({ userId: id });
			toggleSuccessToast("All sessions revoked for user");
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to revoke sessions");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleImpersonateUser = async (id: string) => {
		setIsLoading(`impersonate-${id}`);
		try {
			await client.admin.impersonateUser({ userId: id });
			toggleSuccessToast("Impersonating user");
			router.push("/dashboard");
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to impersonate user");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleStopImpersonating = async () => {
		setIsLoading("stop-impersonating");
		try {
			await client.admin.stopImpersonating();
			toggleSuccessToast("Stopped impersonating");
			resetAndRefetch();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to stop impersonating");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleBanUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(`ban-${banForm.userId}`);
		try {
			if (!banForm.expirationDate) {
				throw new Error("Expiration date is required");
			}
			await client.admin.banUser({
				userId: banForm.userId,
				banReason: banForm.reason,
				banExpiresIn:
					banForm.expirationDate.getTime() - new Date().getTime(),
			});
			toggleSuccessToast("User banned successfully");
			setIsBanDialogOpen(false);
			resetAndRefetch();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to ban user");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleUnban = async (id: string) => {
		setIsLoading(`ban-${id}`);
		try {
			await client.admin.unbanUser({ userId: id });
			toggleSuccessToast("User unbanned successfully");
			resetAndRefetch();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to unban user");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleSetRole = async (
		id: string,
		role:
			| "owner"
			| "developer"
			| "admin"
			| "mod"
			| "trusted"
			| "creator"
			| "user",
	) => {
		setIsLoading(`role-${id}`);
		try {
			await client.admin.setRole({ userId: id, role: role as any });
			toggleSuccessToast("Role updated");
			resetAndRefetch();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to update role");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleRenameUser = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!renameFor) return;
		setIsLoading(`rename-${renameFor.userId}`);
		try {
			const res = await fetch(`/api/admin/users/${renameFor.userId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: renameName }),
			});
			if (!res.ok) {
				const msg = await res.text();
				throw new Error(msg || "Failed to rename user");
			}
			toggleSuccessToast("User renamed");
			setRenameFor(null);
			setRenameName("");
			resetAndRefetch();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to rename user");
		} finally {
			setIsLoading(undefined);
		}
	};

	const handleSetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!pwdDialogFor) return;
		setIsLoading(`pwd-${pwdDialogFor.userId}`);
		try {
			// Uses Better Auth admin plugin capability, if available
			await (client as any).admin.setPassword({
				userId: pwdDialogFor.userId,
				password: newPassword,
			});
			toggleSuccessToast("Password updated");
			setPwdDialogFor(null);
			setNewPassword("");
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to set password");
		} finally {
			setIsLoading(undefined);
		}
	};

	const {
		data: sessionsData,
		refetch: refetchSessions,
		isFetching: isSessionsLoading,
	} = useQuery<SessionsResult>({
		queryKey: ["user-sessions", sessionsFor?.userId],
		queryFn: async () => {
			if (!sessionsFor) return { sessions: [] } as SessionsResult;
			const res = await client.admin.listUserSessions({
				userId: sessionsFor.userId,
			});
			return res as any as SessionsResult;
		},
		enabled: !!sessionsFor,
	});

	const handleRevokeSession = async (token: string) => {
		setIsLoading(`revoke-session-${token}`);
		try {
			await client.admin.revokeUserSession({ sessionToken: token });
			toggleSuccessToast("Session revoked");
			await refetchSessions();
		} catch (error: any) {
			toggleErrorToast(error.message || "Failed to revoke session");
		} finally {
			setIsLoading(undefined);
		}
	};

	const isImpersonating = !!(
		session.data && (session.data as any)?.session?.impersonatedBy
	);

	return (
		<div className="container mx-auto p-4 space-y-8">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
					<CardTitle className="text-2xl">Admin Dashboard</CardTitle>
					<div className="flex items-center gap-2">
						{isImpersonating && (
							<Button
								variant="destructive"
								onClick={handleStopImpersonating}
								disabled={isLoading === "stop-impersonating"}
							>
								{isLoading === "stop-impersonating" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<UserMinus className="mr-2 h-4 w-4" />
								)}
								Stop Impersonating
							</Button>
						)}
						<Dialog
							open={isDialogOpen}
							onOpenChange={setIsDialogOpen}
						>
							<DialogTrigger asChild>
								<Button>
									<Plus className="mr-2 h-4 w-4" /> Create
									User
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create New User</DialogTitle>
								</DialogHeader>
								<form
									onSubmit={handleCreateUser}
									className="space-y-4"
								>
									<div>
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											value={newUser.email}
											onChange={(e) =>
												setNewUser({
													...newUser,
													email: e.target.value,
												})
											}
											required
										/>
									</div>
									<div>
										<Label htmlFor="password">
											Password
										</Label>
										<Input
											id="password"
											type="password"
											value={newUser.password}
											onChange={(e) =>
												setNewUser({
													...newUser,
													password: e.target.value,
												})
											}
											required
										/>
									</div>
									<div>
										<Label htmlFor="name">Name</Label>
										<Input
											id="name"
											value={newUser.name}
											onChange={(e) =>
												setNewUser({
													...newUser,
													name: e.target.value,
												})
											}
											required
										/>
									</div>
									<div>
										<Label htmlFor="role">Role</Label>
										<Select
											value={newUser.role}
											onValueChange={(
												value: "admin" | "user",
											) =>
												setNewUser({
													...newUser,
													role: value as any,
												})
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select role" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="admin">
													Admin
												</SelectItem>
												<SelectItem value="user">
													User
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<Button
										type="submit"
										className="w-full"
										disabled={isLoading === "create"}
									>
										{isLoading === "create" ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Creating...
											</>
										) : (
											"Create User"
										)}
									</Button>
								</form>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{/* Toolbar: search, sort, page size */}
					<div className="flex flex-wrap items-center gap-2">
						<Input
							placeholder="Search users"
							className="w-64"
							value={qParams.searchValue}
							onChange={(e) =>
								setQParams((p) => ({
									...p,
									searchValue: e.target.value,
									offset: 0,
								}))
							}
						/>
						<Select
							value={qParams.searchField}
							onValueChange={(v: any) =>
								setQParams((p) => ({
									...p,
									searchField: v,
									offset: 0,
								}))
							}
						>
							<SelectTrigger className="w-36">
								<SelectValue placeholder="Field" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="email">Email</SelectItem>
								<SelectItem value="name">Name</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={qParams.sortBy}
							onValueChange={(v) =>
								setQParams((p) => ({
									...p,
									sortBy: v as any,
									offset: 0,
								}))
							}
						>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="Sort by" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="createdAt">
									Created At
								</SelectItem>
								<SelectItem value="email">Email</SelectItem>
								<SelectItem value="name">Name</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={qParams.sortDirection}
							onValueChange={(v: any) =>
								setQParams((p) => ({
									...p,
									sortDirection: v,
									offset: 0,
								}))
							}
						>
							<SelectTrigger className="w-28">
								<SelectValue placeholder="Direction" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="desc">Desc</SelectItem>
								<SelectItem value="asc">Asc</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={String(qParams.limit)}
							onValueChange={(v) =>
								setQParams((p) => ({
									...p,
									limit: Number(v),
									offset: 0,
								}))
							}
						>
							<SelectTrigger className="w-28">
								<SelectValue placeholder="Page size" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="10">10</SelectItem>
								<SelectItem value="25">25</SelectItem>
								<SelectItem value="50">50</SelectItem>
							</SelectContent>
						</Select>
						<div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
							<span>
								{offset + 1}-{Math.min(offset + limit, total)}{" "}
								of {total}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={!hasPrev || isUsersLoading}
								onClick={() =>
									setQParams((p) => ({
										...p,
										offset: Math.max(
											0,
											(p.offset || 0) - (p.limit || 10),
										),
									}))
								}
							>
								<SquareChevronLeft className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!hasNext || isUsersLoading}
								onClick={() =>
									setQParams((p) => ({
										...p,
										offset:
											(p.offset || 0) + (p.limit || 10),
									}))
								}
							>
								<SquareChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{isUsersLoading ? (
						<div className="flex justify-center items-center h-64">
							<Loader2 className="h-8 w-8 animate-spin" />
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Email</TableHead>
									<TableHead>Name</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Banned</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{users?.map((user: User) => (
									<TableRow key={user.id}>
										<TableCell>{user.email}</TableCell>
										<TableCell>{user.name}</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<Badge
													variant={
														[
															"owner",
															"developer",
															"admin",
														].includes(user.role)
														? "default"
														: "outline"
													}
												>
													{user.role || "user"}
												</Badge>
												<Select
													value={user.role || "user"}
													onValueChange={(v: any) =>
														handleSetRole(
															user.id,
															v as any,
														)
													}
												>
													<SelectTrigger className="h-8 w-40">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="owner">
															Owner
														</SelectItem>
														<SelectItem value="developer">
															Developer
														</SelectItem>
														<SelectItem value="admin">
															Admin
														</SelectItem>
														<SelectItem value="mod">
															Mod
														</SelectItem>
														<SelectItem value="trusted">
															Trusted
														</SelectItem>
														<SelectItem value="creator">
															Creator
														</SelectItem>
														<SelectItem value="user">
															User
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</TableCell>
										<TableCell>
											{user.banned ? (
												<Badge variant="destructive">
													Yes
												</Badge>
											) : (
												<Badge variant="outline">
													No
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-2">
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															size="sm"
															aria-label="Rename user"
															onClick={() =>
																setRenameFor({
																	userId: user.id,
																	email: user.email,
																	name: user.name,
																})
															}
														>
															<Pencil className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														Rename user
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="destructive"
															size="sm"
															aria-label="Delete user"
															onClick={() =>
																handleDeleteUser(
																	user.id,
																)
															}
															disabled={isLoading?.startsWith(
																"delete",
															)}
														>
															{isLoading ===
																`delete-${user.id}` ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Trash className="h-4 w-4" />
															)}
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														Delete user
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															size="sm"
															aria-label="Revoke all sessions"
															onClick={() =>
																handleRevokeSessions(
																	user.id,
																)
															}
															disabled={isLoading?.startsWith(
																"revoke",
															)}
														>
															{isLoading ===
																`revoke-${user.id}` ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<RefreshCw className="h-4 w-4" />
															)}
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														Revoke all sessions
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="secondary"
															size="sm"
															aria-label="Impersonate user"
															onClick={() =>
																handleImpersonateUser(
																	user.id,
																)
															}
															disabled={isLoading?.startsWith(
																"impersonate",
															)}
														>
															{isLoading ===
																`impersonate-${user.id}` ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<UserCircle className="h-4 w-4" />
															)}
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														Impersonate user
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															size="sm"
															aria-label="Set password"
															onClick={() =>
																setPwdDialogFor({
																	userId: user.id,
																	email: user.email,
																})
															}
														>
															<KeyRound className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														Set a new password
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															size="sm"
															aria-label="View sessions"
															onClick={() =>
																setSessionsFor({
																	userId: user.id,
																	email: user.email,
																})
															}
														>
															<ListChecks className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														View and revoke sessions
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															size="sm"
															aria-label={user.banned ? "Unban user" : "Ban user"}
															onClick={async () => {
																if (user.banned) {
																	await handleUnban(user.id);
																} else {
																	setBanForm({
																		userId: user.id,
																		reason: "",
																		expirationDate: undefined,
																	});
																	setIsBanDialogOpen(true);
																}
															}}
															disabled={isLoading?.startsWith("ban")}
														>
														{isLoading === `ban-${user.id}` ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<ShieldCheck className="h-4 w-4" />
														)}
													</Button>
												</TooltipTrigger>
												<TooltipContent>
													Ban or unban user
												</TooltipContent>
											</Tooltip>
										</div>
									</TableCell>
								</TableRow>
							))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Ban dialog */}
			<Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Ban User</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleBanUser} className="space-y-4">
						<div>
							<Label htmlFor="reason">Reason</Label>
							<Input
								id="reason"
								value={banForm.reason}
								onChange={(e) =>
									setBanForm({
										...banForm,
										reason: e.target.value,
									})
								}
								required
							/>
						</div>
						<div className="flex flex-col space-y-1.5">
							<Label htmlFor="expirationDate">
								Expiration Date
							</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										id="expirationDate"
										variant={"outline"}
										className={cn(
											"w-full justify-start text-left font-normal",
											!banForm.expirationDate &&
												"text-muted-foreground",
										)}
									>
										<CalendarIcon className="mr-2 h-4 w-4" />
										{banForm.expirationDate ? (
											format(
												banForm.expirationDate,
												"PPP",
											)
										) : (
											<span>Pick a date</span>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0">
									<Calendar
											mode="single"
											selected={banForm.expirationDate}
											onSelect={(date) =>
												setBanForm({
													...banForm,
													expirationDate: date,
												})
											}
											initialFocus
										/>
								</PopoverContent>
							</Popover>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={isLoading === `ban-${banForm.userId}`}
						>
							{isLoading === `ban-${banForm.userId}` ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Banning...
								</>
							) : (
								"Ban User"
							)}
						</Button>
					</form>
				</DialogContent>
			</Dialog>

			{/* Set password dialog */}
			<Dialog
				open={!!pwdDialogFor}
				onOpenChange={(o) => !o && setPwdDialogFor(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Set Password{" "}
							{pwdDialogFor ? `for ${pwdDialogFor.email}` : ""}
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSetPassword} className="space-y-4">
						<div>
							<Label htmlFor="newPassword">New Password</Label>
							<Input
								id="newPassword"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								required
							/>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={
								!!isLoading && isLoading.startsWith("pwd-")
							}
						>
							{!!isLoading && isLoading.startsWith("pwd-") ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								"Save Password"
							)}
						</Button>
					</form>
				</DialogContent>
			</Dialog>

			{/* Sessions dialog */}
			<Dialog
				open={!!sessionsFor}
				onOpenChange={(o) => !o && setSessionsFor(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Sessions {sessionsFor ? `for ${sessionsFor.email}` : ""}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									aria-label="Revoke all sessions"
									onClick={() =>
										sessionsFor && handleRevokeSessions(sessionsFor.userId)
									}
									disabled={isLoading?.startsWith("revoke-")}
								>
									{isLoading?.startsWith("revoke-") ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Revoke all sessions</TooltipContent>
						</Tooltip>
						<div className="max-h-80 overflow-auto rounded border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Token</TableHead>
										<TableHead>Created</TableHead>
										<TableHead>Expires</TableHead>
										<TableHead>Action</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{isSessionsLoading ? (
										<TableRow>
											<TableCell colSpan={4}>
												<Loader2 className="h-4 w-4 animate-spin" />
											</TableCell>
										</TableRow>
									) : (
										sessionsData?.sessions?.map((s) => (
											<TableRow key={s.sessionToken}>
												<TableCell className="max-w-[240px] truncate">{s.sessionToken}</TableCell>
												<TableCell>{s.createdAt ? format(new Date(s.createdAt), "PPpp") : "-"}</TableCell>
												<TableCell>{s.expires ? format(new Date(s.expires), "PPpp") : "-"}</TableCell>
												<TableCell>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																variant="destructive"
																size="sm"
																aria-label="Revoke session"
																onClick={() => handleRevokeSession(s.sessionToken)}
																disabled={isLoading === `revoke-session-${s.sessionToken}`}
															>
																{isLoading === `revoke-session-${s.sessionToken}` ? (
																	<Loader2 className="h-4 w-4 animate-spin" />
																) : (
																	<Trash className="h-4 w-4" />
																)}
															</Button>
														</TooltipTrigger>
														<TooltipContent>Revoke session</TooltipContent>
													</Tooltip>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Rename dialog */}
			<Dialog
				open={!!renameFor}
				onOpenChange={(o) => !o && setRenameFor(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Rename User{" "}
							{renameFor ? `(${renameFor.email})` : ""}
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleRenameUser} className="space-y-4">
						<div>
							<Label htmlFor="renameName">New Name</Label>
							<Input
								id="renameName"
								value={renameName}
								onChange={(e) => setRenameName(e.target.value)}
								required
							/>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={
								!!isLoading && isLoading.startsWith("rename-")
							}
						>
							{!!isLoading && isLoading.startsWith("rename-") ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								"Save"
							)}
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
