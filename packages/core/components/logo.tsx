import Image from "next/image";

export const Logo = () => {
	return (
		<Image src="/logo.png" alt="SL Tools" width={60} height={45} priority />
	);
};
