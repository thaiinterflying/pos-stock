'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PowerIcon, PowerOffIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { setProductActiveAction } from '@/server/actions/products.actions';

type ProductActiveToggleProps = {
  productId: string;
  productName: string;
  isActive: boolean;
};

export function ProductActiveToggle({
  productId,
  productName,
  isActive,
}: ProductActiveToggleProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await setProductActiveAction({ productId, isActive: !isActive });

      if (result.ok) {
        toast.success(result.message ?? 'อัปเดตสถานะเรียบร้อยแล้ว');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={isActive ? 'outline' : 'secondary'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isActive ? (
          <PowerOffIcon aria-hidden="true" />
        ) : (
          <PowerIcon aria-hidden="true" />
        )}
        {isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={isActive ? 'ปิดใช้งานสินค้า' : 'เปิดใช้งานสินค้า'}
        description={
          isActive
            ? `${productName} จะถูกซ่อนจากรายการสินค้าและไม่สามารถรับเข้า/เบิกออกได้ แต่ประวัติและยอดคงเหลือจะยังอยู่ครบ`
            : `${productName} จะกลับมาแสดงในรายการและสามารถเคลื่อนไหวสต๊อกได้อีกครั้ง`
        }
        confirmLabel={isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
        destructive={isActive}
        pending={pending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
