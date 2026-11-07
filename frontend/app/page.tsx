import PasswordLoginForm from '../components/PasswordLoginForm';

export default function LoginPage() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f1f5f9',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
  style={{
    textAlign: 'center',
    marginBottom: '24px',
  }}
>
  <img
    src="/logo.png"
    alt="School Logo"
    style={{
      width: '90px',
      height: '90px',
      objectFit: 'contain',
      marginBottom: '12px',
    }}
  />

  <h2
    style={{
      fontSize: '30px',
      fontWeight: '700',
      color: '#0f172a',
      margin: 0,
      lineHeight: '1.3',
    }}
  >
    72 дугаар сургууль
    <br />
    Багшийн систем
  </h2>
</div>

        <PasswordLoginForm />
      </div>
    </div>
  );
}