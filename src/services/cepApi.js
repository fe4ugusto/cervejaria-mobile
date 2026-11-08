/**
 * Serviço de integração com a API ViaCEP
 */
export async function consultarCep(cep) {
  if (!cep) return null;

  const cepLimpo = cep.replace(/\D/g, "");

  if (cepLimpo.length !== 8) {
    throw new Error("O CEP deve conter exatamente 8 dígitos.");
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    
    if (!response.ok) {
      throw new Error(`Erro na requisição: status ${response.status}`);
    }

    const data = await response.json();

    if (data.erro) {
      throw new Error("CEP não encontrado.");
    }

    return {
      cep: data.cep,
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      uf: data.uf || "",
      ibge: data.ibge || "",
    };
  } catch (error) {
    console.error("Erro ao consultar ViaCEP:", error);
    throw error;
  }
}
