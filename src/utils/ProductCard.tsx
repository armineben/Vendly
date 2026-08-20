export function ProductCard({ name, category, price, imageUrl, showAddButton, onAdd }: any) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Affichage de l'image */}
      <img 
        src={imageUrl} 
        alt={name} 
        className="w-full h-48 object-cover rounded-lg mb-4" 
      />
      
      {/* Informations produit */}
      <h3 className="font-bold text-lg text-slate-800">{name}</h3>
      <p className="text-sm text-slate-500 mb-2">{category}</p>
      <p className="text-xl font-bold text-blue-600">{price} DT</p>
      
      {/* Bouton conditionnel (n'apparaît que pour le vendeur) */}
      {showAddButton && (
        <button 
          onClick={onAdd}
          className="mt-4 w-full bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800"
        >
          Ajouter au stock
        </button>
      )}
    </div>
  );
}