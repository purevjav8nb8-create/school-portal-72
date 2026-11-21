import PasswordLoginForm from '../components/PasswordLoginForm';

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-brand" aria-label="72-р сургууль" />
      <section className="login-panel">
        <div className="login-3d-card" aria-label="Багшийн нэвтрэх хэсэг">
          <h1>Нэвтрэх</h1>
          <h2>72-р сургууль</h2>
          <PasswordLoginForm />
        </div>
      </section>
    </main>
  );
}