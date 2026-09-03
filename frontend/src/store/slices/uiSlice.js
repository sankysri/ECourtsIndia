import { createSlice } from '@reduxjs/toolkit';

const getInitialSidebarState = () => {
  try {
    const saved = localStorage.getItem('nyaya_sidebar_collapsed');
    return saved !== null ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
};

const initialState = {
  sidebarCollapsed: getInitialSidebarState(),
  mobileMenuOpen: false,
  contextPanelOpen: false,
  contextPanelContent: null, // { type: 'QUEUE_DETAIL' | 'HEALTH_INSPECTOR' | 'AUDIT_DETAIL', data: {} }
  globalSearchOpen: false,
  healthModalOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem('nyaya_sidebar_collapsed', JSON.stringify(state.sidebarCollapsed));
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
      localStorage.setItem('nyaya_sidebar_collapsed', JSON.stringify(state.sidebarCollapsed));
    },
    toggleMobileMenu: (state) => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    setMobileMenuOpen: (state, action) => {
      state.mobileMenuOpen = action.payload;
    },
    openContextPanel: (state, action) => {
      state.contextPanelOpen = true;
      state.contextPanelContent = action.payload;
    },
    closeContextPanel: (state) => {
      state.contextPanelOpen = false;
      state.contextPanelContent = null;
    },
    setGlobalSearchOpen: (state, action) => {
      state.globalSearchOpen = action.payload;
    },
    setHealthModalOpen: (state, action) => {
      state.healthModalOpen = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  toggleMobileMenu,
  setMobileMenuOpen,
  openContextPanel,
  closeContextPanel,
  setGlobalSearchOpen,
  setHealthModalOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
