"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { transitionTypesFor } from "@/app/lib/navigation/navDirection";

/**
 * A <Link> inside the site that tags the navigation forward or back (see
 * navDirection), so PageTransition slides the content the right way.
 */
export const NavLink = ({
	href,
	...props
}: Omit<ComponentProps<typeof Link>, "href" | "transitionTypes"> & {
	href: string;
}) => {
	const pathname = usePathname();
	return (
		<Link
			href={href}
			transitionTypes={transitionTypesFor(pathname, href)}
			{...props}
		/>
	);
};
