'use client';

interface Props {
  activeCategory: string;
  setActiveCategory: (category: 'Ирц' | 'Сургалт' | 'Үнэлгээ') => void;
}

export default function SideMenu({ activeCategory, setActiveCategory }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {(['Ирц', 'Сургалт', 'Үнэлгээ'] as const).map((category) => {
        const isActive = activeCategory === category;
        return (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            style={{
              backgroundColor: isActive ? '#ea580c' : '#fb923c',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '24px',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: isActive ? '0 4px 10px rgba(234, 88, 12, 0.4)' : 'none',
              transform: isActive ? 'scale(1.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}