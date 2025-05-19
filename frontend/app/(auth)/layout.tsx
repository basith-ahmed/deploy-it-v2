export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-black text-white bg-[radial-gradient(circle_at_left,_#0a0a23_1%,_black_100%)] bg-fixed">
      <section className="border-r-[1px] border-white/20 w-full center flex justify-center items-center">
        <div className="flex flex-col items-start justify-center space-y-6 leading-none">
          <h1 className="text-2xl font-bold text-white/80">Deploy It</h1>
          <h2 className="text-6xl font-extrabold leading-none tracking-wide">
            Cloud
            <br />
            Deployment
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 text-transparent bg-clip-text">
              Platform.
            </span>
          </h2>
          <p className="text-xl max-w-[25rem] text-white/80">
            A highly scalable cloud deployment platform that serves
            instant and seamless deployment of web apps with subdomain,
            analytics and build logs.
          </p>
        </div>
      </section>
      {children}
    </div>
  );
}
