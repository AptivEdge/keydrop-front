"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion";
import {
  Alert as ShadcnAlert,
  AlertDescription,
  AlertTitle,
} from "./components/ui/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "./components/ui/avatar";
import { Badge as ShadcnBadge } from "./components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb";
import {
  Button as ShadcnButton,
} from "./components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Input } from "./components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "./components/ui/sidebar";
import { Progress } from "./components/ui/progress";
import { Separator } from "./components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "./components/ui/sheet";
import { Skeleton } from "./components/ui/skeleton";
import { Switch } from "./components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import { cn } from "./cn";
import { LoaderCircle, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";

type ButtonVariant = NonNullable<ComponentProps<typeof ShadcnButton>["variant"]> | "primary" | "neutral";
type ButtonSize = NonNullable<ComponentProps<typeof ShadcnButton>["size"]> | "small";

export interface ButtonProps extends Omit<ComponentProps<typeof ShadcnButton>, "variant" | "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  className,
  variant = "neutral",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const shadcnVariant = variant === "primary" || variant === "neutral" ? "default" : variant;
  const shadcnSize = size === "small" ? "sm" : size;

  return (
    <ShadcnButton
      className={className}
      variant={shadcnVariant}
      size={shadcnSize}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
      {children}
    </ShadcnButton>
  );
}

export type BadgeTone = "neutral" | "coral" | "success" | "warning" | "danger";

export function Badge({
  className,
  tone = "neutral",
  variant,
  ...props
}: ComponentProps<typeof ShadcnBadge> & {
  tone?: BadgeTone;
}) {
  const toneClasses = {
    neutral: "",
    coral: "border-primary/20 bg-primary/5 text-primary",
    success: "border-status-success/30 bg-status-success/10 text-status-success",
    warning: "border-status-warning/30 bg-status-warning/10 text-status-warning",
    danger: "",
  } satisfies Record<BadgeTone, string>;
  const badgeVariant = variant ?? (tone === "danger" ? "destructive" : "outline");

  return (
    <ShadcnBadge
      className={cn(toneClasses[tone], className)}
      data-tone={tone}
      variant={badgeVariant}
      {...props}
    />
  );
}

export type AlertTone = "info" | "success" | "warning" | "danger";

export function Alert({
  className,
  tone = "info",
  title,
  children,
  role,
  ...props
}: Omit<ComponentProps<typeof ShadcnAlert>, "variant"> & {
  tone?: AlertTone;
  title?: string;
}) {
  return (
    <ShadcnAlert
      className={cn(
        tone === "success" && "border-status-success/30 bg-status-success/5",
        tone === "warning" && "border-status-warning/30 bg-status-warning/5",
        tone === "info" && "border-status-info/30 bg-status-info/5",
        className,
      )}
      data-tone={tone}
      role={role ?? (tone === "danger" ? "alert" : "status")}
      variant={tone === "danger" ? "destructive" : "default"}
      {...props}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </ShadcnAlert>
  );
}

export function TableContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative w-full overflow-x-auto", className)} {...props} />;
}

export const SelectIcon = ChevronsUpDown;
export const SelectScrollUp = ChevronUp;
export const SelectScrollDown = ChevronDown;
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  Separator,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
};
