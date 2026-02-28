import { Gamepad2, Mail, Shield, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "サイトについて - 俺的ゲームニュース",
    description: "俺的ゲームニュースのサイト紹介、運営者情報、お問い合わせ、プライバシーポリシー、利用規約。",
};

export default function AboutPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            {/* Header */}
            <div className="mb-10">
                <Link
                    href="/"
                    className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
                >
                    <ArrowLeft className="h-4 w-4" />
                    トップへ戻る
                </Link>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/25">
                        <Gamepad2 className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white sm:text-3xl">
                        サイトについて
                    </h1>
                </div>
            </div>

            {/* About Section */}
            <section className="mb-12 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">
                    俺的ゲームニュースとは
                </h2>
                <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    <p>
                        「俺的ゲームニュース」は、ゲームに関する最新ニュースや話題をまとめてお届けするゲームブログです。
                    </p>
                    <p>
                        新作ゲームの情報、ハードウェアのリーク、セール情報、インディーゲームの紹介など、
                        ゲーマーが気になる話題を幅広く取り上げています。
                    </p>
                    <p>
                        ネットの反応も合わせてお届けすることで、様々な視点からゲームについて楽しめるサイトを目指しています。
                    </p>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="mb-12 scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                <div className="mb-4 flex items-center gap-2">
                    <Mail className="h-5 w-5 text-orange-500" />
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                        お問い合わせ
                    </h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    <p>
                        記事の内容に関するご指摘、広告掲載のご相談、その他お問い合わせは下記メールアドレスまでお願いいたします。
                    </p>
                    <div className="rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
                        <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                            contact@oreteki-game.example.com
                        </p>
                    </div>
                    <p className="text-xs text-zinc-400">
                        ※ 返信までに数日かかる場合がございます。ご了承ください。
                    </p>
                </div>
            </section>

            {/* Privacy Policy */}
            <section id="privacy" className="mb-12 scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                <div className="mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-500" />
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                        プライバシーポリシー
                    </h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">1. 個人情報の取得</h3>
                    <p>
                        当サイトでは、お問い合わせの際にメールアドレス等の個人情報をご提供いただく場合があります。
                        取得した個人情報は、お問い合わせへの回答以外の目的では使用いたしません。
                    </p>

                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">2. アクセス解析ツール</h3>
                    <p>
                        当サイトでは、Googleアナリティクスを使用しています。Googleアナリティクスはトラフィックデータの収集のためにCookieを使用しています。
                        トラフィックデータは匿名で収集されており、個人を特定するものではありません。
                    </p>

                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">3. 広告について</h3>
                    <p>
                        当サイトでは、第三者配信の広告サービスを利用しています。広告配信事業者は、ユーザーの興味に応じた広告を表示するためにCookieを使用することがあります。
                    </p>

                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">4. 免責事項</h3>
                    <p>
                        当サイトに掲載された情報の正確性については万全を期していますが、その内容を保証するものではありません。
                        当サイトの情報を利用したことにより生じた損害等について、一切の責任を負いかねます。
                    </p>
                </div>
            </section>

            {/* Terms of Service */}
            <section id="terms" className="mb-12 scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-500" />
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                        利用規約
                    </h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">1. コンテンツの利用</h3>
                    <p>
                        当サイトのコンテンツ（文章・画像等）の無断転載・複製を禁じます。
                        引用する場合は、出典を明記の上、リンクをお願いいたします。
                    </p>

                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">2. リンクについて</h3>
                    <p>
                        当サイトへのリンクは、基本的に自由です。ただし、不正な目的でのリンクはお断りさせていただく場合があります。
                    </p>

                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">3. 著作権</h3>
                    <p>
                        当サイトに掲載されているゲームの画像や名称等は、各メーカーの商標または登録商標です。
                        当サイトは各メーカー等とは一切関係ありません。
                    </p>

                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">4. 規約の変更</h3>
                    <p>
                        当サイトは、必要に応じて利用規約を変更することがあります。
                        変更後の利用規約は、当サイトに掲載した時点で効力を生じるものとします。
                    </p>
                </div>
            </section>
        </div>
    );
}
