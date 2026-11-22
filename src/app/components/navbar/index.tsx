"use client";
import { usePathname } from "next/navigation";
import { AddToHomeScreenHint } from "@/app/components/addToHomeScreenHint";
import { NavLink } from "@/app/components/navLink";
import { useInstallPrompt } from "@/app/hooks/useInstallPrompt";
import { cn } from "@/app/lib/cn";

export const Navbar = () => {
	const pathname = usePathname();
	const isSelf = (path: string) => path === pathname;
	const { hint, install, dismissHint } = useInstallPrompt();

	return (
		<nav
			// Named so the navbar stays put while page content slides (globals.css).
			style={{ viewTransitionName: "site-nav" }}
			className="shrink-0 ps-[max(0.5rem,env(safe-area-inset-left))] pe-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.25rem,env(safe-area-inset-bottom))]"
		>
			<ul className="flex items-center justify-end gap-4">
				<li>
					<NavLink
						className={cn(
							"cursor-pointer underline-offset-2 decoration-wavy hover:decoration-solid hover:underline-offset-2",
							isSelf("/") && "underline",
						)}
						href={"/"}
					>
						~
					</NavLink>
				</li>
				<li>
					<NavLink
						className={cn(
							"cursor-pointer underline-offset-2 decoration-wavy hover:decoration-solid hover:underline-offset-2",
							isSelf("/lab") && "underline",
						)}
						href={"/lab"}
					>
						/lab
					</NavLink>
				</li>
				{hint === "prompt" && (
					<li>
						<button
							type="button"
							onClick={install}
							className="cursor-pointer underline-offset-2 decoration-wavy hover:underline"
						>
							Install app
						</button>
					</li>
				)}
			</ul>
			{hint === "ios" && <AddToHomeScreenHint onDismiss={dismissHint} />}
		</nav>
	);
};
