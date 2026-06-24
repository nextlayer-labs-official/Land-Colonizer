export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center gap-3">
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="flex-1 py-6 px-4 max-w-4xl mx-auto w-full space-y-4">
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}
      </div>
    </div>
  );
}
