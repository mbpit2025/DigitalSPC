
import Link from "next/link";

function HomePage() {  
  return (
    <div className="grid grid-cols-12 gap-2 md:gap-6">
      <div className="col-span-12 dark:text-gray-200">
        <Link href='/dashboard'>
        Masuk Ke Dashboard 
        </Link>
      </div>

    </div>
  )
}

export default HomePage;