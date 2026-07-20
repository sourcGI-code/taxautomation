import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FIRM, firmDisplayName } from "@/lib/firm";
import {
  Calendar,
  FileText,
  Bell,
  Shield,
  MapPin,
  Phone,
  Star,
  Clock,
  CheckCircle2,
  Navigation,
} from "lucide-react";

export default function HomePage() {
  const practiceName = firmDisplayName();

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-[#1a4a6e] text-white">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,#fff_0%,transparent_50%)]" />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-navy-100 mb-3 tracking-wide">
                {FIRM.proprietor} · Tax preparation service
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
                {practiceName}
              </h1>
              <p className="text-lg md:text-xl text-navy-100 mb-6 leading-relaxed">
                Friendly, professional tax prep in the heart of Wabash.
                Book online, upload your documents securely, and stay updated
                every step of the way.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-8 text-sm">
                <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
                  <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <strong className="text-white">{FIRM.rating}</strong>
                  <span className="text-navy-100">{FIRM.reviewCountLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-navy-100">
                  <MapPin className="w-4 h-4" />
                  {FIRM.cityStateZip}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/book">
                  <Button
                    size="lg"
                    className="bg-white text-navy-800 hover:bg-navy-50 w-full sm:w-auto shadow-lg"
                  >
                    <Calendar className="w-5 h-5" />
                    Book an appointment
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/40 text-white hover:bg-white/10 w-full sm:w-auto"
                  >
                    Client login
                  </Button>
                </Link>
                <a href={`tel:${FIRM.phoneTel}`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/40 text-white hover:bg-white/10 w-full sm:w-auto"
                  >
                    <Phone className="w-5 h-5" />
                    {FIRM.phone}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact bar */}
        <section className="border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 grid sm:grid-cols-3 gap-6 text-sm">
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Visit us</p>
                <p className="text-slate-600">{FIRM.addressLine}</p>
                <p className="text-slate-600">{FIRM.cityStateZip}</p>
                <a
                  href={FIRM.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-navy-700 font-medium mt-1 hover:underline"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Directions
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <Phone className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Call</p>
                <a
                  href={`tel:${FIRM.phoneTel}`}
                  className="text-navy-700 font-medium text-base hover:underline"
                >
                  {FIRM.phone}
                </a>
                <p className="text-slate-500 mt-1">Wabash, Indiana</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Hours</p>
                <p className="text-emerald-700 font-medium">Open now</p>
                <p className="text-slate-600 mt-0.5">{FIRM.hoursNote}</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
              Tax prep made simple
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              From appointment to filed return — handle everything online with{" "}
              {practiceName}, then sit down with Ken when you need to.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Calendar,
                title: "Book online anytime",
                desc: "Pick a time that works for you. Get instant confirmation by email.",
              },
              {
                icon: FileText,
                title: "Upload docs securely",
                desc: "Send W-2s, 1099s, and IDs through your private client login — encrypted storage.",
              },
              {
                icon: Bell,
                title: "Track your return",
                desc: "See status updates from intake through ready-to-sign and filed.",
              },
              {
                icon: Shield,
                title: "Sign electronically",
                desc: "Review and authorize when your return is ready — no paper chase.",
              },
              {
                icon: Phone,
                title: "Local & personal",
                desc: "Real people in Wabash. Call or stop by at 19 E Main St.",
              },
              {
                icon: CheckCircle2,
                title: "Trusted by neighbors",
                desc: `${FIRM.rating} on Google. Clients love Ken’s knowledge and down-to-earth style.`,
              },
            ].map((feature) => (
              <Card
                key={feature.title}
                className="hover:shadow-md hover:border-navy-200 transition-all duration-200"
              >
                <CardContent className="pt-6">
                  <div className="w-11 h-11 rounded-xl bg-navy-50 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-navy-700" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Reviews */}
        <section className="bg-slate-100 border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-1 text-amber-500 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${i <= 4 ? "fill-amber-400 text-amber-400" : "fill-amber-200 text-amber-200"}`}
                  />
                ))}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {FIRM.rating} on Google
              </h2>
              <p className="text-slate-600 mt-1">
                What clients say about {FIRM.proprietor} and the team
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {FIRM.reviews.map((r) => (
                <Card key={r.author} className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex gap-0.5 text-amber-400 mb-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed mb-4">
                      &ldquo;{r.quote}&rdquo;
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {r.author}
                    </p>
                    <p className="text-xs text-slate-500">Google review</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-3 text-slate-900">
              Ready to get started?
            </h2>
            <p className="text-slate-600 mb-8 max-w-lg mx-auto">
              Book online in minutes, or call us at{" "}
              <a
                href={`tel:${FIRM.phoneTel}`}
                className="text-navy-700 font-medium hover:underline"
              >
                {FIRM.phone}
              </a>
              .
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/book">
                <Button size="lg">
                  <Calendar className="w-5 h-5" />
                  Book your appointment
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Existing client login
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-900 text-slate-300 py-12">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-semibold text-white text-base mb-2">
              {practiceName}
            </p>
            <p className="text-slate-400 mb-1">{FIRM.proprietor}</p>
            <p>Tax preparation service</p>
            <p className="mt-2">Wabash, Indiana</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Contact</p>
            <p>{FIRM.fullAddress}</p>
            <a
              href={`tel:${FIRM.phoneTel}`}
              className="block mt-1 text-white hover:underline"
            >
              {FIRM.phone}
            </a>
            <a
              href={FIRM.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-navy-100 hover:underline"
            >
              Get directions
            </a>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Online</p>
            <div className="flex flex-col gap-1.5">
              <Link href="/book" className="hover:text-white">
                Book appointment
              </Link>
              <Link href="/login" className="hover:text-white">
                Client login
              </Link>
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-10 pt-6 border-t border-slate-700 text-xs text-slate-500">
          © {new Date().getFullYear()} {practiceName}. {FIRM.fullAddress}. All
          rights reserved.
        </div>
      </footer>
    </>
  );
}
