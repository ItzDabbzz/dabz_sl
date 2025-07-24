'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IoArrowBack, IoCart, IoHeart, IoShare, IoStar, IoSparkles, IoDiamond, IoFlame, IoRocket, IoCheckmarkCircle, IoBrush, IoGift, IoShield } from 'react-icons/io5';
import { convertLindenToUSD, formatUSD } from '@/hooks/useLindenExchange';
import AudioWaveform from '@/components/AudioWaveform';
import { useAudio } from '@/contexts/AudioContext';
type Asset = {
    id: string;
    name: string;
    image: string;
    description: string;
    category?: string;
    price?: string;
};

const FLOATING_ICONS = [
    <IoSparkles key="sparkles" />,
    <IoDiamond key="diamond" />,
    <IoFlame key="flame" />,
    <IoStar key="star" />,
    <IoHeart key="heart" />,
    <IoCart key="cart" />,
    <IoBrush key="brush" />,
    <IoGift key="gift" />
];

export default function DetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [asset, setAsset] = useState<Asset | null>(null);
    const [loading, setLoading] = useState(true);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isClient, setIsClient] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [rate, setRate] = useState(0);
    const { toggle, isPlaying, volume, setVolume } = useAudio();

    useEffect(() => {
        const fetchRate = async () => {
            try {
                const response = await fetch('/api/exchange-rate');
                if (response.ok) {
                    const data = await response.json();
                    setRate(data.rate);
                }
            } catch (error) {
                console.error('Failed to fetch exchange rate:', error);
            }
        };

        fetchRate();
    }, []);


    useEffect(() => {
        setIsClient(true);

        // Load asset data
        fetch('/assets.json')
            .then(r => r.json())
            .then((assets: Asset[]) => {
                const foundAsset = assets.find(a => a.id === params.id);
                setAsset(foundAsset || null);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, [params.id]);

    useEffect(() => {
        if (!isClient) return;

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isClient]);

    if (loading) {
        return (
            <main className="relative min-h-screen px-6 py-12 bg-gradient-to-br from-background via-background/95 to-[var(--accent)]/5 text-foreground overflow-x-hidden">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 border-4 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full"
                    />
                </div>
            </main>
        );
    }

    if (!asset) {
        return (
            <main className="relative min-h-screen px-6 py-12 bg-gradient-to-br from-background via-background/95 to-[var(--accent)]/5 text-foreground overflow-x-hidden">
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-6xl text-[var(--accent)]"
                    >
                        <IoHeart className="w-16 h-16" />
                    </motion.div>
                    <h1 className="text-4xl font-bold text-[var(--accent)]">Asset Not Found</h1>
                    <p className="text-muted-foreground text-center max-w-md">
                        The asset you're looking for doesn't exist or has been removed.
                    </p>
                    <Button
                        onClick={() => router.push('/')}
                        className="bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent)]/80"
                    >
                        <IoArrowBack className="w-4 h-4 mr-2" />
                        Back to Home
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main className="relative min-h-screen px-6 py-12 bg-gradient-to-br from-background via-background/95 to-[var(--accent)]/5 text-foreground overflow-x-hidden">
            {/* Animated cursor glow */}
            {isClient && (
                <div
                    className="fixed w-96 h-96 rounded-full bg-[var(--accent)]/10 blur-3xl pointer-events-none z-0 transition-all duration-300 ease-out"
                    style={{
                        left: mousePosition.x - 192,
                        top: mousePosition.y - 192,
                    }}
                />
            )}

            {/* Floating particles */}
            <div className="fixed inset-0 pointer-events-none z-10">
                {FLOATING_ICONS.map((icon, i) => (
                    <motion.div
                        key={i}
                        className="absolute text-2xl opacity-20 text-[var(--accent)]"
                        animate={{
                            y: [0, -20, 0],
                            x: [0, Math.sin(i) * 10, 0],
                            rotate: [0, 360],
                        }}
                        transition={{
                            duration: 3 + i,
                            repeat: Infinity,
                            delay: i * 0.5,
                        }}
                        style={{
                            left: `${10 + (i * 12)}%`,
                            top: `${20 + (i * 8)}%`,
                        }}
                    >
                        {icon}
                    </motion.div>
                ))}
            </div>

            {/* Background effects */}
            <div className="absolute inset-0 -z-10 opacity-5">
                <div className="absolute inset-0 bg-[url('/sparkles.svg')] bg-cover animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 via-transparent to-[var(--accent)]/5 animate-pulse" />
            </div>

            {/* Back button */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8 relative z-20"
            >
                <Button
                    variant="ghost"
                    onClick={() => router.push('/')}
                    className="text-[var(--accent)] hover:bg-[var(--accent)]/10 border border-[var(--accent)]/30 hover:border-[var(--accent)] transition-all duration-300"
                >
                    <IoArrowBack className="w-4 h-4 mr-2" />
                    Back to Gallery
                </Button>
            </motion.div>

            {/* Main content */}
            <div className="max-w-7xl mx-auto relative z-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    {/* Image section */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="space-y-6"
                    >
                        <Card className="bg-[var(--card)]/80 border-2 border-[var(--accent)]/30 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative overflow-hidden">
                                <motion.img
                                    src={asset.image}
                                    alt={asset.name}
                                    className="w-full h-[500px] lg:h-[600px] object-cover transition-transform duration-500 group-hover:scale-105"
                                    initial={{ opacity: 0, scale: 1.1 }}
                                    animate={{ opacity: imageLoaded ? 1 : 0, scale: imageLoaded ? 1 : 1.1 }}
                                    onLoad={() => setImageLoaded(true)}
                                />

                                {/* Category badge */}
                                <div className="absolute top-6 left-6 bg-[var(--accent)]/90 text-[var(--background)] px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide backdrop-blur-sm">
                                    {asset.category || 'Premium'}
                                </div>

                                {/* Action buttons overlay */}
                                <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <Button size="sm" variant="ghost" className="bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 rounded-full w-10 h-10 p-0">
                                        <IoHeart className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 rounded-full w-10 h-10 p-0">
                                        <IoShare className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                            </div>
                        </Card>

                        {/* Additional info cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-[var(--card)]/60 border border-[var(--accent)]/20 backdrop-blur-sm p-4 text-center">
                                <div className="text-2xl mb-2 text-[var(--accent)] flex justify-center">
                                    <IoStar className="w-8 h-8" />
                                </div>
                                <div className="text-sm text-muted-foreground">Premium Quality</div>
                            </Card>
                            <Card className="bg-[var(--card)]/60 border border-[var(--accent)]/20 backdrop-blur-sm p-4 text-center">
                                <div className="text-2xl mb-2 text-[var(--accent)] flex justify-center">
                                    <IoRocket className="w-8 h-8" />
                                </div>
                                <div className="text-sm text-muted-foreground">Instant Delivery</div>
                            </Card>
                        </div>
                    </motion.div>

                    {/* Details section */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="space-y-8"
                    >
                        {/* Title and price */}
                        <div className="space-y-4">
                            <motion.h1
                                className="text-5xl lg:text-6xl font-black text-[var(--accent)] leading-tight"
                                animate={{
                                    textShadow: [
                                        "0 0 20px var(--accent)",
                                        "0 0 40px var(--accent)",
                                        "0 0 20px var(--accent)"
                                    ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                {asset.name}
                            </motion.h1>

                            {asset.price && (
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="text-4xl font-bold text-[var(--accent)]">
                                        L$ {asset.price}
                                    </span>
                                    {rate > 0 && (
                                        <span className="text-2xl font-semibold text-green-400">
                                            ≈ {formatUSD(convertLindenToUSD(Number(asset.price), rate))}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 text-yellow-400">
                                        {[...Array(5)].map((_, i) => (
                                            <IoStar key={i} className="w-5 h-5 fill-current" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <Card className="bg-[var(--card)]/60 border border-[var(--accent)]/20 backdrop-blur-sm p-6">
                            <CardHeader className="p-0 mb-4">
                                <CardTitle className="text-xl text-[var(--accent)]">Description</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <p className="text-muted-foreground leading-relaxed text-lg">
                                    {asset.description}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Features */}
                        <Card className="bg-[var(--card)]/60 border border-[var(--accent)]/20 backdrop-blur-sm p-6">
                            <CardHeader className="p-0 mb-4">
                                <CardTitle className="text-xl text-[var(--accent)]">Features</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ul className="space-y-3 text-muted-foreground">
                                    <li className="flex items-center gap-3">
                                        <IoSparkles className="w-5 h-5 text-[var(--accent)]" />
                                        High-quality textures and materials
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <IoBrush className="w-5 h-5 text-[var(--accent)]" />
                                        Custom designed by DABZ
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <IoGift className="w-5 h-5 text-[var(--accent)]" />
                                        Copy/Modify permissions
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <IoDiamond className="w-5 h-5 text-[var(--accent)]" />
                                        Exclusive design
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Action buttons */}
                        <div className="space-y-4">
                            <Button
                                className="w-full bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent)]/80 text-lg py-6 rounded-xl font-bold uppercase tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-lg"
                                onClick={() => {
                                    // Add your purchase logic here
                                    console.log('Purchase clicked for:', asset.id);
                                }}
                            >
                                <IoCart className="w-5 h-5 mr-3" />
                                Purchase Now
                            </Button>

                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    className="border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all duration-300"
                                >
                                    <IoHeart className="w-4 h-4 mr-2" />
                                    Add to Wishlist
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all duration-300"
                                >
                                    <IoShare className="w-4 h-4 mr-2" />
                                    Share
                                </Button>
                            </div>
                        </div>

                        {/* Additional details */}
                        <Card className="bg-[var(--card)]/60 border border-[var(--accent)]/20 backdrop-blur-sm p-6">
                            <CardHeader className="p-0 mb-4">
                                <CardTitle className="text-xl text-[var(--accent)]">Product Details</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Category:</span>
                                        <span className="ml-2 text-[var(--accent)] font-semibold capitalize">
                                            {asset.category || 'Premium'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Creator:</span>
                                        <span className="ml-2 text-[var(--accent)] font-semibold">DABZ</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Permissions:</span>
                                        <span className="ml-2 text-[var(--accent)] font-semibold">Copy/Modify</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Delivery:</span>
                                        <span className="ml-2 text-[var(--accent)] font-semibold">Instant</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Related items section */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-24"
                >
                    <h2 className="text-3xl font-bold text-[var(--accent)] mb-8 text-center">
                        More from DABZ Collection
                    </h2>
                    <div className="text-center text-muted-foreground">
                        <p>Explore more premium assets in our collection</p>
                        <Button
                            variant="outline"
                            onClick={() => router.push('/')}
                            className="mt-4 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all duration-300"
                        >
                            Browse All Assets
                        </Button>
                    </div>
                </motion.div>
            </div>

            {/* Enhanced Footer */}
            <motion.footer
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                className="mt-32 border-t-2 border-[var(--accent)]/30 pt-8 text-center relative z-20"
            >
                <div className="space-y-4">
                    <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                        made with <IoSparkles className="w-4 h-4 text-[var(--accent)]" /> catppuccin, shadcn, and too many hours in SL
                    </div>
                    <div className="text-[var(--accent)] font-bold">
                        dabz.dev · Premium SL Assets · Est. 2024
                    </div>
                </div>
            </motion.footer>
        </main>
    );
}