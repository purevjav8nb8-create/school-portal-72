'use client';

import { DashboardCategory } from '../types';

interface Props {
  activeCategory: DashboardCategory;
  setActiveCategory: (category: DashboardCategory) => void;
  categories?: DashboardCategory[];
}

const defaultCategories: DashboardCategory[] = ['Ирц', 'Сургалт', 'Үнэлгээ'];

export default function SideMenu({ activeCategory, setActiveCategory, categories = defaultCategories }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {categories.map((category) => {
        const isActive = activeCategory === category;
        return (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            style={{
              backgroundColor: isActive ? '#ea580c' : '#fb923c',
              color: 'white',
              border: 'none',
              padding: '7px 12px',
              borderRadius: '24px',
              fontWeight: 'bold',
              fontSize: '14px',
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