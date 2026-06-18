import ShopForm from '@/components/shop/ShopForm'

export const metadata = {
  title: '샵 등록',
}

export default function ShopNewPage() {
  return <ShopForm mode="create" />
}