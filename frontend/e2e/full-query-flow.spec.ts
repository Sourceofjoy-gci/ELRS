import { test, expect } from '@playwright/test'

test.describe('Full Query Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard/research')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows landing page with hero section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Legal Intelligence/i })).toBeVisible()
    await expect(page.getByText(/Kingdom of Eswatini/i)).toBeVisible()
  })

  test('shows privacy badges on landing page', async ({ page }) => {
    await expect(page.getByText(/100% Local AI/i)).toBeVisible()
    await expect(page.getByText(/Docker-Native/i)).toBeVisible()
    await expect(page.getByText(/Eswatini Law Corpus/i)).toBeVisible()
  })

  test('shows feature cards', async ({ page }) => {
    await expect(page.getByText(/Hybrid Search/i)).toBeVisible()
    await expect(page.getByText(/Multi-Agent Reasoning/i)).toBeVisible()
    await expect(page.getByText(/Verified Citations/i)).toBeVisible()
    await expect(page.getByText(/Air-Gapped Privacy/i)).toBeVisible()
  })

  test('has working navigation to login', async ({ page }) => {
    await page.getByRole('link', { name: /Sign In/i }).first().click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('has working navigation to register', async ({ page }) => {
    await page.getByRole('link', { name: /Get Started/i }).first().click()
    await expect(page).toHaveURL(/\/register/)
  })
})

test.describe('Authentication Flow', () => {
  test('shows login form with required fields', async ({ page }) => {
    await page.goto('/login')
    
    await expect(page.getByLabel(/Email/i)).toBeVisible()
    await expect(page.getByLabel(/Password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
  })

  test('shows register form with all fields', async ({ page }) => {
    await page.goto('/register')
    
    await expect(page.getByLabel(/Full Name/i)).toBeVisible()
    await expect(page.getByLabel(/Email/i)).toBeVisible()
    await expect(page.getByLabel(/Password/i)).toBeVisible()
    await expect(page.getByLabel(/Organisation/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Create account/i })).toBeVisible()
  })

  test('shows error on invalid login', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/Email/i).fill('invalid@example.com')
    await page.getByLabel(/Password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /Sign in/i }).click()
    
    await expect(page.getByText(/Invalid credentials/i)).toBeVisible({ timeout: 5000 })
  })

  test('redirects to dashboard after successful login', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/Email/i).fill('test@eswatini.sz')
    await page.getByLabel(/Password/i).fill('password123')
    await page.getByRole('button', { name: /Sign in/i }).click()
    
    await expect(page).toHaveURL(/\/dashboard\/research/, { timeout: 10000 })
  })
})

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/Email/i).fill('test@eswatini.sz')
    await page.getByLabel(/Password/i).fill('password123')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await page.waitForURL(/\/dashboard\/research/, { timeout: 10000 })
  })

  test('shows sidebar with navigation links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Research/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Documents/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /History/i })).toBeVisible()
  })

  test('navigates to documents page', async ({ page }) => {
    await page.getByRole('link', { name: /Documents/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/documents/)
  })

  test('navigates to history page', async ({ page }) => {
    await page.getByRole('link', { name: /History/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/history/)
  })

  test('shows chat interface on research page', async ({ page }) => {
    await expect(page.getByPlaceholder(/Ask about Eswatini law/i)).toBeVisible()
    await expect(page.getByText(/Start Your Legal Research/i)).toBeVisible()
  })
})

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/Email/i).fill('test@eswatini.sz')
    await page.getByLabel(/Password/i).fill('password123')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await page.waitForURL(/\/dashboard\/research/, { timeout: 10000 })
  })

  test('accepts input in chat box', async ({ page }) => {
    const input = page.getByPlaceholder(/Ask about Eswatini law/i)
    await input.fill('What does section 35 say?')
    await expect(input).toHaveValue('What does section 35 say?')
  })

  test('shows submit button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '' }).last()).toBeVisible()
  })

  test('shows keyboard shortcut hint', async ({ page }) => {
    await expect(page.getByText(/Ctrl \+ Enter/i)).toBeVisible()
  })
})

test.describe('Document Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/Email/i).fill('test@eswatini.sz')
    await page.getByLabel(/Password/i).fill('password123')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await page.waitForURL(/\/dashboard\/research/, { timeout: 10000 })
    await page.getByRole('link', { name: /Documents/i }).click()
  })

  test('shows document table', async ({ page }) => {
    await expect(page.getByText(/Title/i)).toBeVisible()
    await expect(page.getByText(/Type/i)).toBeVisible()
    await expect(page.getByText(/Year/i)).toBeVisible()
    await expect(page.getByText(/Status/i)).toBeVisible()
  })

  test('shows search input', async ({ page }) => {
    await expect(page.getByPlaceholder(/Search by title or act number/i)).toBeVisible()
  })

  test('shows filter dropdowns', async ({ page }) => {
    await expect(page.getByText(/All types/i)).toBeVisible()
    await expect(page.getByText(/All statuses/i)).toBeVisible()
  })
})
